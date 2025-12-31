import { Injectable } from '@angular/core';
import { delay } from 'lodash-es';
import { runInAction } from 'mobx';
import { filter, map, mergeMap, Subject, switchMap, takeUntil, takeWhile, timer } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../model/ref';
import { Store } from '../store/store';
import { escapePath, OpPatch } from '../util/json-patch';
import { getUserUrl, hasTag, localTag, setPublic } from '../util/tag';
import { AdminService } from './admin.service';
import { RefService } from './api/ref.service';
import { StompService } from './api/stomp.service';
import { TaggingService } from './api/tagging.service';
import { ConfigService } from './config.service';

/**
 * Interface for video signaling data structure used in WebRTC communication
 */
interface VideoSignaling {
  hangup?: boolean;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit[];
}

@Injectable({
  providedIn: 'root',
})
export class VideoService {
  private destroy$ = new Subject<void>();
  poll = 30_000;
  fastPoll = 4_000;
  stuck = 30_000;
  jitter = 2_000;

  url = '';

  websockets = false;

  private stream?: MediaStream;

  constructor(
    private config: ConfigService,
    private admin: AdminService,
    private store: Store,
    private stomp: StompService,
    private ts: TaggingService,
    private refs: RefService,
  ) { }

  get connecting() {
    return !this.store.video.peers.size || !!this.store.video.peers.values().find(p => p.connectionState !== 'connected');
  }

  call(url: string, stream: MediaStream) {
    if (this.url === url) return;
    console.warn('Joining Lobby!');
    this.stream = stream;
    this.url = url;
    this.destroy$.next();
    runInAction(() => this.store.video.stream = stream);
    this.invite();
    this.answer();
  }

  hangup() {
    console.warn('Hung Up!');
    this.url = '';
    for (const user of this.store.video.peers.keys()) {
      this.ts.mergeResponse([setPublic(localTag(user)), '-plugin/user/video', 'plugin/user/video'], 'tag:/' + localTag(user), {
        'plugin/user/video': { hangup: true }
      }).subscribe();
    }
    this.store.video.hangup();
    this.destroy$.next();
  }

  peer(user: string) {
    if (this.store.video.peers.has(user)) return this.store.video.peers.get(user)!;
    const peer = new RTCPeerConnection(this.admin.getPlugin('plugin/user/video')!.config!.rtc);
    this.store.video.call(user, peer);
    this.seen.delete(user);
    peer.addEventListener('icecandidate', event => {
      this.patch(user, [{
        op: 'add',
        path: '/' + escapePath('plugin/user/video') + '/candidate/-',
        value: event.candidate?.toJSON() || { candidate: null },
      }]);
    });
    peer.addEventListener('icecandidateerror', event => {
      console.error(event.errorCode, event.errorText);
      this.store.video.remove(user);
      this.ts.respond([setPublic(localTag(user)), '-plugin/user/video', 'plugin/user/video'], 'tag:/' + localTag(user))
        .subscribe(() => this.invite());
    });
    peer.addEventListener('connectionstatechange', event => {
      if (peer.connectionState === 'connected') {
        this.ts.respond([setPublic(localTag(user)), '-plugin/user/video'], 'tag:/' + localTag(user))
          .subscribe();
      }
      if (['disconnected', 'failed'].includes(peer.connectionState)) {
        this.store.video.remove(user);
        this.ts.respond([setPublic(localTag(user)), '-plugin/user/video', 'plugin/user/video'], 'tag:/' + localTag(user))
          .subscribe(() => this.invite());
      }
      console.log('connectionstatechange', peer.connectionState);
    });
    peer.addEventListener('track',  (event) => {
      const [remoteStream] = event.streams;
      this.store.video.addStream(user, remoteStream);
    });
    this.stream?.getTracks().forEach(t => peer.addTrack(t, this.stream!));
    return peer;
  }

  invite() {
    const doInvite = (user: string) => {
      delay(() => {
        if (this.store.video.peers.has(user)) return;
        const peer = this.peer(user);
        peer.createOffer().then(offer => {
          peer.setLocalDescription(offer).then(() => {
            console.warn('Making Offer!', user);
            this.ts.mergeResponse([setPublic(localTag(user)), '-plugin/user/video', 'plugin/user/video'], 'tag:/' + localTag(user), {
              'plugin/user/video': { offer }
            }).subscribe();
            delay(() => {
              if (peer.localDescription && !peer.remoteDescription) {
                console.error('Stuck!');
                this.store.video.remove(user);
                this.invite();
              }
            }, this.stuck);
          });
        });
      }, Math.random() * this.jitter);
    };
    const poll = () => this.refs.page({
      query: 'plugin/user/lobby',
      responses: this.url,
    }).pipe(
      mergeMap(page => page.content),
      map(ref => getUserUrl(ref)),
      filter(user => !!user),
      filter(user => user !== this.store.account.tag),
    ).subscribe(user => doInvite(user));
    if (this.config.websockets) {
      poll();
      this.stomp.watchResponse(this.url).pipe(
        tap(() => this.websockets = true),
        switchMap(url => this.refs.getCurrent(url)),
        filter(res => hasTag('plugin/user/lobby', res)),
        map(ref => getUserUrl(ref)),
        filter(user => !!user),
        filter(user => user !== this.store.account.tag),
        takeUntil(this.destroy$)
      ).subscribe(user => doInvite(user));
    }
    timer(0, this.poll).pipe(
      takeWhile(() => !this.websockets),
      takeUntil(this.destroy$),
    ).subscribe(() => poll());
  }

  seen = new Map<string, Set<string>>();
  answer() {
    const doAnswer = (res: Ref) => {
      const user = getUserUrl(res);
      if (!user || user === this.store.account.tag) return;
      const video = res.plugins?.['plugin/user/video'] as VideoSignaling | undefined;
      if (!video) return;
      if (video.hangup) {
        console.warn('Hung Up!', user);
        this.store.video.remove(user);
        return;
      }
      let peer = this.peer(user);
      if (peer.connectionState === 'connected') return;
      if (!peer.remoteDescription && !peer.pendingRemoteDescription) {
        if (peer.signalingState === 'have-local-offer') {
          if (video.answer) {
            console.warn('Accept Answer!', user);
            peer.setRemoteDescription(new RTCSessionDescription(video.answer));
          } else if (video.offer) {
            console.warn('Double Offer!', user);
            console.warn('Cancelled Offer! (will accept offer)', user);
            this.store.video.remove(user);
            peer = this.peer(user);
          }
        }
        if (peer.signalingState === 'stable' && !peer.localDescription && !peer.pendingLocalDescription) {
          if (video.offer) {
            console.warn('Accept Offer!', user, peer.signalingState);
            peer.setRemoteDescription(new RTCSessionDescription(video.offer))
              .then(() => peer.createAnswer())
              .then(answer => {
                peer.setLocalDescription(answer).then(() => {
                  console.warn('Send Answer!', user);
                  this.ts.mergeResponse([setPublic(localTag(user)), '-plugin/user/video', 'plugin/user/video'], 'tag:/' + localTag(user), {
                    'plugin/user/video': { answer }
                  }).subscribe();
                });
              });
          }
        }
      }
      if (peer.iceConnectionState !== 'completed' &&  peer.remoteDescription && video.candidate?.length) {
        video.candidate.forEach((c) => {
          const hash = JSON.stringify(c);
          if (this.seen.get(user)?.has(hash)) return;
          if (!this.seen.get(user)) this.seen.set(user, new Set<string>());
          this.seen.get(user)?.add(hash);
          console.warn('Adding Ice!', user);
          peer.addIceCandidate(c.candidate ? c : null).catch(err => {
            console.error('Error adding received ice candidate', err);
          });
        });
      }
    };
    const poll = () => this.refs.page({
      query: 'plugin/user/video',
      responses: 'tag:/' + this.store.account.localTag,
    }).pipe(
      mergeMap(page => page.content),
    ).subscribe(ref => doAnswer(ref));
    if (this.config.websockets) {
      poll();
      this.stomp.watchResponse('tag:/' + this.store.account.localTag).pipe(
        tap(() => this.websockets = true),
        switchMap(url => this.refs.getCurrent(url)),
        filter(res => hasTag('plugin/user/video', res)),
        takeUntil(this.destroy$)
      ).subscribe(ref => doAnswer(ref));
    }
    timer(0, this.poll).pipe(
      takeWhile(() => !this.websockets),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      if (!this.connecting) poll();
    });
    timer(0, this.fastPoll).pipe(
      takeWhile(() => !this.websockets),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      if (this.connecting) poll();
    });
  }

  queue = new Map<string, OpPatch[]>();
  patch(user: string, ops: OpPatch[]) {
    const scheduled = !this.queue.size;
    const throttle = 400;
    if (this.queue.has(user)) {
      this.queue.get(user)!.push(...ops);
    } else {
      this.queue.set(user, ops);
    }
    if (!scheduled) delay(() => {
      for (const [u, o] of this.queue.entries()) {
        this.ts.patchResponse(['plugin/user/video'], 'tag:/' + localTag(u), o).subscribe();
      }
      this.queue.clear();
    }, throttle);
  }
}
