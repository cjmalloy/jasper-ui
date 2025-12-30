import { Injectable } from '@angular/core';
import { delay } from 'lodash-es';
import { runInAction } from 'mobx';
import { filter, map, mergeMap, Subject, switchMap, takeUntil } from 'rxjs';
import { Store } from '../store/store';
import { escapePath } from '../util/json-patch';
import { getUserUrl, hasTag, localTag, setPublic } from '../util/tag';
import { RefService } from './api/ref.service';
import { StompService } from './api/stomp.service';
import { TaggingService } from './api/tagging.service';

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

  url = '';

  config: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ],
  };

  private stream?: MediaStream;

  constructor(
    private store: Store,
    private stomp: StompService,
    private ts: TaggingService,
    private refs: RefService,
  ) { }

  peer(user: string) {
    if (this.store.video.peers.has(user)) return this.store.video.peers.get(user)!;
    const peer = new RTCPeerConnection(this.config);
    this.store.video.call(user, peer);
    this.ts.respond(['-plugin/user/video', 'plugin/user/video'], 'tag:/' + localTag(user))
      .subscribe();
    peer.addEventListener('icecandidate', event => {
      if (event.candidate) {
        this.ts.patchResponse([setPublic(localTag(user)), 'plugin/user/video'], 'tag:/' + localTag(user), [{
          op: 'add',
          path: '/' + escapePath('plugin/user/video') + '/candidate/-',
          value: event.candidate.toJSON(),
        }]).subscribe();
      }
    });
    peer.addEventListener('connectionstatechange', event => {
      if (peer.connectionState === 'connected') {
        this.ts.respond([setPublic(localTag(user)), '-plugin/user/video', 'plugin/user/video'], 'tag:/' + localTag(user))
          .subscribe();
      }
      if (['disconnected', 'failed'].includes(peer.connectionState)) {
        this.store.video.remove(user);
        this.ts.respond(['-plugin/user/video', 'plugin/user/video'], 'tag:/' + localTag(user))
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
    const jitter = 2_000;
    this.refs.page({ query: 'plugin/user/lobby', responses: this.url })
      .pipe(
        mergeMap(page => page.content),
        map(ref => getUserUrl(ref)),
        filter(user => !!user),
        filter(user => user !== this.store.account.tag),
      ).subscribe(user => {
        delay(() => {
          if (this.store.video.peers.has(user)) return;
          const peer = this.peer(user);
          peer.createOffer().then(offer => {
            peer.setLocalDescription(offer).then(() => {
              console.warn('Making Offer!', user);
              delay(() => {
                if (peer.signalingState === 'have-local-offer') {
                  console.error('Stuck!');
                  this.store.video.remove(user);
                  this.invite();
                }
              }, 10_000);
              this.ts.mergeResponse([setPublic(localTag(user)), '-plugin/user/video', 'plugin/user/video'], 'tag:/' + localTag(user), {
                'plugin/user/video': { offer }
              }).subscribe();
            });
          });
        }, Math.random() * jitter);
    });
  }

  call(url: string, stream: MediaStream) {
    if (this.url === url) return;
    console.warn('Joining Lobby!');
    this.stream = stream;
    this.url = url;
    this.destroy$.next();
    runInAction(() => this.store.video.stream = stream);
    this.invite();
    // TODO: Watch remote mapped tags
    this.stomp.watchResponse('tag:/' + this.store.account.localTag).pipe(
      switchMap(url => this.refs.getCurrent(url)),
      filter(res => hasTag('plugin/user/video', res)),
      takeUntil(this.destroy$)
    ).subscribe(res => {
      const user = getUserUrl(res);
      if (!user || user === this.store.account.tag) return;
      let peer = this.peer(user);
      const video = res.plugins?.['plugin/user/video'] as VideoSignaling | undefined;
      if (!video) return;
      if (video.hangup) {
        console.warn('Hung Up!', user);
        this.store.video.remove(user);
        return;
      }
      if (peer.connectionState === 'connected') return;
      if (peer.signalingState === 'have-local-offer') {
        if (video.answer) {
          console.warn('Accept Answer!', user);
          peer.setRemoteDescription(new RTCSessionDescription(video.answer));
        } else if (video.offer) {
          console.error('Double Offer!', user);
          if (user < this.store.account.tag) {
            console.warn('Cancelled Offer! (will accept offer)', user);
            this.store.video.remove(user);
            peer = this.peer(user);
          } else {
            console.warn('Reject Offer!', user);
          }
        }
      }
      if (peer.signalingState === 'stable') {
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
      if (peer.remoteDescription && video.candidate?.length) {
        console.warn('Adding Ice!', user);
        // TODO: ignore seen
        video.candidate.forEach((c) => {
          peer.addIceCandidate(c).catch(err => {
            console.error('Error adding received ice candidate', err);
          });
        });
      }
    });
  }

  hangup() {
    console.warn('Hung Up!');
    this.url = '';
    for (const user of this.store.video.peers.keys()) {
      this.ts.mergeResponse(['-plugin/user/video', 'plugin/user/video'], 'tag:/' + localTag(user), {
        'plugin/user/video': { hangup: true }
      }).subscribe();
    }
    this.store.video.hangup();
    this.destroy$.next();
  }

}
