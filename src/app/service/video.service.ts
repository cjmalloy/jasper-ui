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
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit[];
}

function getSessionId(sdp: string): string {
  const match = sdp.match(/^o=\S+ (\d+) /m);
  return match?.[1] || '';
}

@Injectable({
  providedIn: 'root',
})
export class VideoService {
  private destroy$ = new Subject<void>();
  hostDelay = 30_000;
  poll = 30_000;
  fastPoll = 4_000;
  stuck = 30_000;
  maxInitial = 100;

  url = '';

  lobbyWebsocket = false;
  peerWebsocket = false;
  initialInvite = false;

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
    this.answer();
    this.invite();
  }

  hangup() {
    console.warn('Hung Up!');
    this.url = '';
    for (const user of this.store.video.peers.keys()) {
      this.ts.respond([setPublic(localTag(user)), '-plugin/user/video'], 'tag:/' + localTag(user))
        .subscribe();
    }
    this.store.video.hangup();
    this.destroy$.next();
  }

  peer(user: string) {
    if (this.store.video.peers.has(user)) return this.store.video.peers.get(user)!;
    const peer = new RTCPeerConnection(this.admin.getPlugin('plugin/user/video')!.config!.rtcConfig);
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
    });
    peer.addEventListener('connectionstatechange', event => {
      if (peer.connectionState === 'connected') {
        this.ts.respond([setPublic(localTag(user)), '-plugin/user/video'], 'tag:/' + localTag(user))
          .subscribe();
      }
      if (peer.connectionState === 'failed') {
        this.store.video.reset(user);
        this.offers.delete(user);
        this.ts.respond([setPublic(localTag(user)), '-plugin/user/video'], 'tag:/' + localTag(user))
          .subscribe(() => this.invite());
      }
      console.log('connectionstatechange', peer.connectionState);
    });
    peer.addEventListener('track', (event) => {
      console.warn('Track received:', event.streams[0]?.id, event.track.readyState);
      const [remoteStream] = event.streams;
      this.store.video.addStream(user, remoteStream);
    });
    this.stream?.getTracks().forEach(t => peer.addTrack(t, this.stream!));
    return peer;
  }

  offers = new Map<string, string>();
  invite() {
    const doInvite = async (user: string) => {
      this.initialInvite = true;
      runInAction(() => this.store.video.hungup.set(user, false));
      const checkStuck = () => delay(() => {
        const peer = this.store.video.peers.get(user);
        if (peer?.localDescription && !peer.remoteDescription) {
          console.error('Stuck!');
          this.store.video.reset(user);
          this.offers.delete(user);
          this.invite();
        }
      }, this.stuck);
      if (this.store.video.peers.has(user)) {
        checkStuck();
        return;
      }
      const peer = this.peer(user);
      const offer = await peer.createOffer();
      if (peer.signalingState !== 'stable') {
        // Already accepted remote offer
        return;
      }
      await peer.setLocalDescription(offer);
      console.warn('Making Offer!', user);
      this.offers.set(user, JSON.stringify(offer));
      this.ts.mergeResponse([setPublic(localTag(user)), '-plugin/user/video', 'plugin/user/video'], 'tag:/' + localTag(user), {
        'plugin/user/video': { offer }
      }).subscribe();
      checkStuck();
    };
    const poll = () => this.refs.page({
      query: 'plugin/user/lobby',
      responses: this.url,
      size: this.maxInitial,
    }).pipe(
      mergeMap(page => page.content),
      map(ref => getUserUrl(ref)),
      filter(user => !!user),
      filter(user => user !== this.store.account.tag),
    ).subscribe(user => doInvite(user));
    if (this.config.websockets) {
      poll();
      this.stomp.watchResponse(this.url).pipe(
        tap(() => this.lobbyWebsocket = true),
        switchMap(url => this.refs.getCurrent(url)),
        tap(res => {
          const user = getUserUrl(res);
          const hungup = !hasTag('plugin/user/lobby', res);
          runInAction(() => this.store.video.hungup.set(user, hungup));
          if (hungup && this.store.video.peers.has(user)) {
            console.warn('Hung Up!', user);
            this.store.video.remove(user);
          }
        }),
        filter(res => hasTag('plugin/user/lobby', res)),
        map(res => getUserUrl(res)),
        filter(user => !!user),
        filter(user => user !== this.store.account.tag),
        tap(user => this.peer(user)),
        takeUntil(this.destroy$)
      ).subscribe(user => delay(() => doInvite(user), this.hostDelay));
    }
    timer(0, this.poll).pipe(
      takeWhile(() => !this.lobbyWebsocket),
      takeUntil(this.destroy$),
    ).subscribe(() => poll());
  }

  seen = new Map<string, Set<string>>();
  answer() {
    const doAnswer = async (res: Ref) => {
      const user = getUserUrl(res);
      if (!user || user === this.store.account.tag) return;
      const video = res.plugins?.['plugin/user/video'] as VideoSignaling | undefined;
      if (!video) return;
      if (this.store.video.hungup.get(user)) return;
      let peer = this.store.video.peers.get(user);
      if (peer?.connectionState === 'connected' && video.offer && !video.answer) {
        const newSessionId = getSessionId(video.offer.sdp!);
        const currentSessionId = peer?.remoteDescription
          ? getSessionId(peer.remoteDescription.sdp)
          : '';
        if (newSessionId !== currentSessionId) {
          console.warn('Peer reloaded - resetting connection', user);
          this.store.video.reset(user);
          this.offers.delete(user);
          peer = undefined;  // Will be recreated below
        }
      }
      if (peer?.connectionState === 'connected') return;
      if (peer?.signalingState === 'have-local-offer') {
        if (video.answer) {
          if (this.offers.get(user) !== JSON.stringify(video.offer)) {
            console.warn('Ignored Old Answer!', user);
          } else {
            console.warn('Accept Answer!', user);
            await peer.setRemoteDescription(new RTCSessionDescription(video.answer));
          }
        } else if (video.offer) {
          console.warn('Double Offer!', user);
          if (this.store.account.tag < user) {
            console.warn('Cancelled Offer! (will accept offer)', user);
            await peer.setLocalDescription({ type: 'rollback' });
          } else {
            console.warn('Waiting for answer!', user);
            return;
          }
        }
      }
      if (video.offer && !video.answer && (!peer || peer?.signalingState === 'stable')) {
        peer ||= this.peer(user);
        console.warn('Accept Offer!', user, peer.signalingState);
        await peer.setRemoteDescription(new RTCSessionDescription(video.offer!));
        const answer = await peer.createAnswer();
        await peer!.setLocalDescription(answer);
        console.warn('Send Answer!', user);
        this.ts.mergeResponse([setPublic(localTag(user)), '-plugin/user/video', 'plugin/user/video'], 'tag:/' + localTag(user), {
          'plugin/user/video': { answer, offer: video.offer }
        }).subscribe();
      }
      if (peer?.iceConnectionState !== 'completed' && peer?.remoteDescription && video.candidate?.length) {
        for (const c of video.candidate) {
          const hash = JSON.stringify(c);
          if (this.seen.get(user)?.has(hash)) return;
          if (!this.seen.get(user)) this.seen.set(user, new Set<string>());
          this.seen.get(user)?.add(hash);
          console.warn('Adding Ice!', user);
          try {
            await peer!.addIceCandidate(c.candidate ? c : null);
          } catch (err) {
            console.error('Error adding received ice candidate', err);
          }
        }
      }
    };
    const poll = () => this.refs.page({
      query: 'plugin/user/video',
      responses: 'tag:/' + this.store.account.localTag,
    }).pipe(
      mergeMap(page => page.content),
      filter(res => (!this.peerWebsocket && this.initialInvite) || this.store.video.peers.has(getUserUrl(res))),
    ).subscribe(res => doAnswer(res));
    if (this.config.websockets) {
      poll();
      this.stomp.watchResponse('tag:/' + this.store.account.localTag).pipe(
        tap(() => this.peerWebsocket = true),
        switchMap(url => this.refs.getCurrent(url)),
        filter(res => hasTag('plugin/user/video', res)),
        takeUntil(this.destroy$)
      ).subscribe(ref => doAnswer(ref));
    }
    timer(0, this.poll).pipe(
      takeWhile(() => !this.peerWebsocket),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      if (!this.connecting) poll();
    });
    timer(0, this.fastPoll).pipe(
      takeWhile(() => !this.peerWebsocket),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      if (this.connecting) poll();
    });
  }

  queue = new Map<string, OpPatch[]>();
  patch(user: string, ops: OpPatch[]) {
    const scheduled = !!this.queue.size;
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
