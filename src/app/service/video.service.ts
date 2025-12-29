import { Injectable } from '@angular/core';
import { runInAction } from 'mobx';
import { filter, map, mergeMap, Subject, Subscription, switchMap, takeUntil } from 'rxjs';
import { Store } from '../store/store';
import { escapePath } from '../util/json-patch';
import { getUserUrl, hasTag, setPublic } from '../util/tag';
import { RefService } from './api/ref.service';
import { StompService } from './api/stomp.service';
import { TaggingService } from './api/tagging.service';

/**
 * Interface for video signaling data structure used in WebRTC communication
 */
interface VideoSignaling {
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

  private tx?: Subscription;
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
    peer.addEventListener('icecandidate', event => {
      if (event.candidate) {
        this.ts.patchResponse([setPublic(user), 'plugin/user/video'], 'tag:/' + user, [{
          op: 'add',
          path: '/' + escapePath('plugin/user/video') + '/candidate/-',
          value: event.candidate.toJSON(),
        }]).subscribe();
      }
    });
    peer.addEventListener('connectionstatechange', event => {
      if (peer.connectionState === 'connected') {
        //
      }
      if (peer.connectionState === 'disconnected') {
        this.store.video.remove(user);
        this.ts.deleteResponse('plugin/user/video', 'tag:/' + user).subscribe();
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

  call(url: string, stream: MediaStream) {
    if (this.url === url) return;
    this.stream = stream;
    this.url = url;
    this.destroy$.next();
    runInAction(() => this.store.video.stream = stream);
    this.refs.page({ query: 'plugin/user/lobby', responses: url })
      .pipe(
        mergeMap(page => page.content),
        map(ref => getUserUrl(ref)),
        filter(user => user !== this.store.account.tag),
      ).subscribe(user => {
        const peer = this.peer(user);
        peer.createOffer().then(offer => {
          peer.setLocalDescription(offer).then(() => {
            this.ts.mergeResponse([setPublic(user), 'plugin/user/video'], 'tag:/' + user, {
              'plugin/user/video': { offer }
            }).subscribe();
          });
        });
      });
    this.stomp.watchResponse('tag:/' + this.store.account.localTag).pipe(
      switchMap(url => this.refs.getCurrent(url)),
      takeUntil(this.destroy$)
    ).subscribe(res => {
      const user = getUserUrl(res);
      if (user === this.store.account.tag) return;
      if (!hasTag('plugin/user/video', res)) {
        if (this.store.video.peers.has(user)) {
          this.store.video.remove(user);
          this.ts.deleteResponse('plugin/user/video', 'tag:/' + user).subscribe();
        }
        return;
      }
      const video = res.plugins?.['plugin/user/video'] as VideoSignaling | undefined;
      if (video) {
        const peer = this.peer(user);
        if (video.offer && !peer.remoteDescription) {
          if (!peer.localDescription) {
            peer.setRemoteDescription(new RTCSessionDescription(video.offer))
              .then(() => peer.createAnswer())
              .then(answer => {
                peer.setLocalDescription(answer).then(() => {
                  this.ts.mergeResponse([setPublic(user), 'plugin/user/video'], 'tag:/' + user, {
                    'plugin/user/video': { offer: answer }
                  }).subscribe();
                });
              });
          } else {
            peer.setRemoteDescription(new RTCSessionDescription(video.offer));
          }
        }
        if (video.candidate && peer.remoteDescription) {
          video.candidate.forEach((c) => {
            try {
              peer.addIceCandidate(c);
            } catch (e) {
              console.error('Error adding received ice candidate', e);
            }
          });
        }
      }
    });
  }

  hangup() {
    this.url = '';
    for (const user of this.store.video.peers.keys()) {
      this.ts.deleteResponse('plugin/user/video', 'tag:/' + user).subscribe();
    }
    this.store.video.hangup();
    this.destroy$.next();
  }

}
