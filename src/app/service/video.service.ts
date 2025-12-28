import { Injectable } from '@angular/core';
import { defer, isEqual } from 'lodash-es';
import { runInAction } from 'mobx';
import { catchError, filter, map, mergeMap, of, Subject, Subscription, switchMap, takeUntil } from 'rxjs';
import { Ref } from '../model/ref';
import { Store } from '../store/store';
import { getUserUrl, hasTag } from '../util/tag';
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

  query = '';
  responseOf = '';

  config: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ],
  };

  private res?: Ref;
  private video?: VideoSignaling;
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
        this.send({ type: 'candidate', payload: event.candidate.toJSON() })
      }
    });
    peer.addEventListener('connectionstatechange', event => {
      if (peer.connectionState === 'connected') {
        //
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

  call(query: string, responseOf: string, stream: MediaStream) {
    if (this.query === query && this.responseOf === responseOf) return;
    this.stream = stream;
    this.query = query;
    this.responseOf = responseOf;
    this.destroy$.next();
    runInAction(() => this.store.video.stream = stream);
    this.refs.page({ query: 'plugin/user/video', responses: this.responseOf || ('tag:/' + this.query) })
      .pipe(
        mergeMap(page => page.content),
        map(ref => getUserUrl(ref)),
        filter(user => user !== this.store.account.tag),
      ).subscribe(user => {
        const peer = this.peer(user);
        peer.createOffer().then(offer => {
          peer.setLocalDescription(offer).then(() => {
            defer(() => {
              this.send({ type: 'offer', payload: offer });
            });
          });
        });
      });
    this.stomp.watchResponse(this.responseOf || ('tag:/' + this.query)).pipe(
      switchMap(url => this.refs.getCurrent(url)),
      takeUntil(this.destroy$)
    ).subscribe(res => {
      const user = getUserUrl(res);
      if (user === this.store.account.tag) return;
      const video = res.plugins?.['plugin/user/video'] as VideoSignaling | undefined;
      if (video && hasTag('plugin/user/video', res)) {
        const peer = this.peer(user);
        if (video.offer) {
          peer.setRemoteDescription(new RTCSessionDescription(video.offer))
            .then(() => peer.createAnswer())
            .then(answer => {
              peer.setLocalDescription(answer).then(() => {
                this.send({ type: 'answer', payload: answer });
              });
            });
        }
        if (video.answer) {
          peer.setRemoteDescription(new RTCSessionDescription(video.answer));
        }
        if (video.candidate) {
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

  send(data?: { type: string, payload: any  }) {
    if (data?.type) {
      console.log('Peer trying to send message', data);
      this.video ||= {};
      if (data.type === 'offer') {
        this.video = {};
        this.video.offer = data.payload;
      }
      if (data.type === 'answer') {
        this.video.answer = data.payload;
      }
      if (data.type === 'candidate') {
        this.video.candidate ||= [];
        this.video.candidate.push(data.payload);
      }
    }
    if (!this.video) return;
    if (this.res) {
      if (this.tx) return;
      if (isEqual(this.res.plugins?.['plugin/user/video'], this.video)) return;
      this.res.plugins ||= {};
      this.res.plugins['plugin/user/video'] = this.video;
      delete this.video;
      this.tx = this.refs.update(this.res).pipe(
        catchError(err => {
          if (err.status === 409) {
            this.video = this.res!.plugins!['plugin/user/video'];
            this.res = undefined;
            this.send(data);
            return of();
          }
          console.error(err);
          return of();
        })
      ).subscribe(() => {
        delete this.tx;
        if (this.video) this.send();
      });
    } else {
      this.tx = this.ts.getResponse(this.responseOf || ('tag:/' + this.query))
        .subscribe(res => {
          delete this.tx;
          this.res = res;
          this.send();
        });
    }
  }

  hangup() {
    this.query = '';
    this.responseOf = '';
    this.store.video.hangup();
    this.destroy$.next();
  }

}
