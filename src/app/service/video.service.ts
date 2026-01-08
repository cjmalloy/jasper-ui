import { Injectable, isDevMode } from '@angular/core';
import { runInAction } from 'mobx';
import { filter, map, mergeMap, Subject, switchMap, takeUntil, takeWhile, timer } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../model/ref';
import { Store } from '../store/store';
import { escapePath, OpPatch } from '../util/json-patch';
import { getUserUrl, hasTag, localTag, setPublic, userResponse } from '../util/tag';
import { AdminService } from './admin.service';
import { RefService } from './api/ref.service';
import { StompService } from './api/stomp.service';
import { TaggingService } from './api/tagging.service';
import { ConfigService } from './config.service';

/**
 * Interface for video signaling data structure used in WebRTC communication
 */
interface VideoSignaling {
  dial: number;
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
  maxInitial = 100;

  url = '';

  lobbyWebsocket = false;
  peerWebsocket = false;

  private cleanupHandlers = new Map<string, (() => void)[]>();

  constructor(
    private config: ConfigService,
    private admin: AdminService,
    private store: Store,
    private stomp: StompService,
    private ts: TaggingService,
    private refs: RefService,
  ) {
    if (isDevMode()) timer(3_000, 30_000).pipe(
      mergeMap(() => this.store.video.peers.entries()),
      map(([user, peer]) => ({ user, stats: peer.getStats() })),
    ).subscribe(({ user, stats }) => {
      stats.then(s => s.forEach((v, k) => console.log(user, k, v)));
    });
  }

  get connecting() {
    return !this.store.video.peers.size || !!this.store.video.peers.values().find(p => p.connectionState !== 'connected');
  }

  call(url: string, stream: MediaStream) {
    if (this.url === url) return;
    console.debug('Joining Lobby!');
    this.url = url;
    this.destroy$.next();
    runInAction(() => this.store.video.stream = stream);
    this.invite();
    this.answer();
  }

  hangup() {
    console.debug('Hung Up!');
    this.url = '';
    for (const user of this.store.video.peers.keys()) {
      this.ts.respond([setPublic(localTag(user)), '-plugin/user/video'], userResponse(user))
        .subscribe();
    }
    this.store.video.hangup();
    this.cleanupHandlers.forEach(handlers => handlers.forEach(cleanup => cleanup()));
    this.cleanupHandlers.clear();
    this.destroy$.next();
  }

  peer(user: string) {
    if (this.store.video.peers.has(user)) return this.store.video.peers.get(user)!;
    const peer = new RTCPeerConnection(this.admin.getPlugin('plugin/user/video')!.config!.rtcConfig);
    this.store.video.call(user, peer);
    this.seen.delete(user);
    this.addListener(user, peer, 'icecandidate', (event) => {
      console.debug('Sending Ice Candidate', user);
      this.patch(user, [{
        op: 'add',
        path: '/' + escapePath('plugin/user/video') + '/candidate/-',
        value: event.candidate?.toJSON() || { candidate: null },
      }]);
    });
    this.addListener(user, peer, 'icecandidateerror', (event) => {
      console.error(event.errorCode, event.errorText);
    });
    this.addListener(user, peer, 'connectionstatechange', () => {
      if (peer.connectionState === 'connected') {
        this.ts.respond([setPublic(localTag(user)), '-plugin/user/video'], userResponse(user))
          .subscribe();
      }
      if (peer.connectionState === 'failed') {
        this.resetUserConnection(user);
        this.ts.respond([setPublic(localTag(user)), '-plugin/user/video'], userResponse(user))
          .subscribe(() => this.doInvite(user));
      }
      console.log('connectionstatechange', peer.connectionState);
    });
    this.addListener(user, peer, 'track', (event) => {
      console.debug('Track received:', event.streams[0]?.id, event.track.readyState);
      const [remoteStream] = event.streams;
      this.store.video.addStream(user, remoteStream);
    });
    // TODO: negotiationneeded
    // this.addListener(user, peer, 'negotiationneeded', async (event) => {
    //   if (peer.signalingState !== 'stable') return;
    //   console.warn('Renegotiation needed for', user);
    //   const offer = await peer.createOffer({ iceRestart: true, offerToReceiveAudio: true, offerToReceiveVideo: true });
    //   if (peer.signalingState !== 'stable') {
    //     // Already accepted remote offer
    //     console.debug('Already accepted remote offer!', user);
    //     return;
    //   }
    //   await peer.setLocalDescription(offer);
    //
    // });
    // this.addListener(user, peer, 'iceconnectionstatechange', (event) => {
    //   if (peer.iceConnectionState === 'failed') {
    //     console.warn('Restarting ICE', user);
    //     peer.restartIce();
    //   }
    // });
    this.store.video.stream!.getTracks().forEach(t => peer.addTrack(t, this.store.video.stream!));
    return peer;
  }

  offers = new Map<string, number>();
  doInvite = async (user: string) => {
    runInAction(() => this.store.video.hungup.set(user, false));
    if (this.store.video.peers.has(user)) return;
    const peer = this.peer(user);
    const offer = await peer.createOffer();
    if (peer.signalingState !== 'stable') {
      // Already accepted remote offer
      console.debug('Already accepted remote offer!', user);
      return;
    }
    await peer.setLocalDescription(offer);
    console.debug('Making Offer!', user);
    const dial = Math.random() * Number.MAX_SAFE_INTEGER;
    this.offers.set(user, dial);
    this.ts.mergeResponse([setPublic(localTag(user)), '-plugin/user/video', 'plugin/user/video'], userResponse(user), {
      'plugin/user/video': { offer, dial }
    }).subscribe();
    timer(this.stuck).pipe(
      takeUntil(this.destroy$),
    ).subscribe(() => {
      const peer = this.store.video.peers.get(user);
      if (peer?.localDescription && !peer.remoteDescription) {
        console.error('Stuck!');
        this.resetUserConnection(user);
        this.doInvite(user);
      }
    });
  };
  invite() {
    const pollLobby = () => this.refs.page({
      query: 'plugin/user/lobby',
      responses: this.url,
      size: this.maxInitial,
    }).pipe(
      mergeMap(page => page.content),
      map(ref => getUserUrl(ref)),
      filter(user => !!user),
      filter(user => user !== setPublic(this.store.account.tag)),
      takeUntil(this.destroy$),
    ).subscribe(user => this.doInvite(user));
    if (this.config.websockets) {
      this.stomp.watchResponse(this.url).pipe(
        tap(() => this.lobbyWebsocket = true),
        filter(url => url?.startsWith('tag:/')),
        switchMap(url => this.refs.getCurrent(url)),
        tap(res => {
          const user = getUserUrl(res);
          const hungup = !hasTag('plugin/user/lobby', res);
          runInAction(() => this.store.video.hungup.set(user, hungup));
          if (hungup && this.store.video.peers.has(user)) {
            console.debug('Hung Up!', user);
            this.store.video.remove(user);
          }
        }),
        filter(res => hasTag('plugin/user/lobby', res)),
        map(res => getUserUrl(res)),
        filter(user => !!user),
        filter(user => user !== setPublic(this.store.account.tag)),
        tap(user => this.peer(user)),
        takeUntil(this.destroy$)
      ).subscribe((user: any) => this.doInvite(user));
    }
    timer(this.poll).pipe(
      takeWhile(() => !this.lobbyWebsocket),
      takeUntil(this.destroy$),
    ).subscribe(() => pollLobby());
    pollLobby()
  }

  seen = new Map<string, Set<string>>();
  answer() {
    const doAnswer = async (res: Ref, allowUnknown: boolean) => {
      const user = getUserUrl(res);
      if (!user || user === setPublic(this.store.account.tag)) return;
      const video = res.plugins?.['plugin/user/video'] as VideoSignaling | undefined;
      if (!video) return;
      if (this.store.video.hungup.get(user)) return;
      let peer = this.store.video.peers.get(user);
      if (peer?.connectionState === 'connected' && video.offer && video.dial && !video.answer) {
        if (this.offers.get(user) !== video.dial) {
          console.warn('Peer reloaded - resetting connection', user);
          this.resetUserConnection(user);
          peer = undefined;  // Will be recreated below
        }
      }
      if (peer?.connectionState === 'connected') return;
      if (peer?.signalingState === 'have-local-offer') {
        if (video.answer) {
          if (this.offers.get(user) !== video.dial) {
            console.debug('Ignored Old Answer!', user);
          } else {
            console.debug('Accept Answer!', user);
            await peer.setRemoteDescription(new RTCSessionDescription(video.answer));
          }
        } else if (video.offer) {
          console.debug('Double Offer!', user);
          if (setPublic(this.store.account.tag) < user) {
            console.debug('Cancelled Offer! (will accept offer)', user);
            await peer.setLocalDescription({ type: 'rollback' });
          } else {
            console.debug('Waiting for answer!', user);
            return;
          }
        }
      }
      if (!peer && !allowUnknown) {
        this.ts.deleteResponse('plugin/user/video', userResponse(user)).subscribe();
        return;
      }
      if (video.offer && !video.answer && peer?.signalingState === 'stable') {
        const dial = video.dial;
        peer ||= this.peer(user);
        this.offers.set(user, dial);
        console.debug('Accept Offer!', user, peer.signalingState);
        await peer.setRemoteDescription(new RTCSessionDescription(video.offer!));
        const answer = await peer.createAnswer();
        await peer!.setLocalDescription(answer);
        console.debug('Send Answer!', user);
        this.ts.mergeResponse([setPublic(localTag(user)), '-plugin/user/video', 'plugin/user/video'], userResponse(user), {
          'plugin/user/video': { answer, dial }
        }).subscribe();
      }
      if (peer?.iceConnectionState !== 'completed' && peer?.remoteDescription && video.candidate?.length) {
        for (const c of video.candidate) {
          const hash = JSON.stringify(c);
          if (this.seen.get(user)?.has(hash)) continue;
          if (!this.seen.get(user)) this.seen.set(user, new Set<string>());
          this.seen.get(user)?.add(hash);
          console.debug('Adding Ice!', user);
          try {
            await peer!.addIceCandidate(c.candidate ? c : null);
          } catch (err) {
            console.error('Error adding received ice candidate', err);
          }
        }
      }
    };
    const pollPeer = () => this.refs.page({
      query: 'plugin/user/video',
      responses: userResponse(this.store.account.localTag),
    }).pipe(
      mergeMap(page => page.content),
      takeUntil(this.destroy$),
    ).subscribe(res => doAnswer(res, false));
    if (this.config.websockets) {
      this.stomp.watchResponse(userResponse(this.store.account.localTag)).pipe(
        tap(() => this.peerWebsocket = true),
        switchMap(url => this.refs.getCurrent(url)),
        filter(res => hasTag('plugin/user/video', res)),
        takeUntil(this.destroy$)
      ).subscribe(ref => doAnswer(ref, true));
    }
    timer(0, this.poll).pipe(
      takeWhile(() => !this.peerWebsocket),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      if (!this.connecting) pollPeer();
    });
    timer(0, this.fastPoll).pipe(
      takeWhile(() => !this.peerWebsocket),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      if (this.connecting) pollPeer();
    });
  }

  queue = new Map<string, OpPatch[]>();
  patch(user: string, ops: OpPatch[]) {
    const scheduled = !!this.queue.size;
    const throttle = 50;
    if (this.queue.has(user)) {
      this.queue.get(user)!.push(...ops);
    } else {
      this.queue.set(user, ops);
    }
    if (!scheduled) timer(throttle).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      for (const [user, patch] of this.queue.entries()) {
        this.ts.patchResponse(['plugin/user/video'], userResponse(user), patch).subscribe();
      }
      this.queue.clear();
    });
  }

  private addListener<K extends keyof RTCPeerConnectionEventMap>(
    user: string,
    peer: RTCPeerConnection,
    eventType: K,
    handler: (event: RTCPeerConnectionEventMap[K]) => void
  ): void {
    peer.addEventListener(eventType, handler);
    if (!this.cleanupHandlers.has(user)) {
      this.cleanupHandlers.set(user, []);
    }
    this.cleanupHandlers.get(user)!.push(() => {
      peer.removeEventListener(eventType, handler);
    });
  }

  private resetUserConnection(user: string): void {
    const handlers = this.cleanupHandlers.get(user);
    if (handlers) {
      handlers.forEach(cleanup => cleanup());
      this.cleanupHandlers.delete(user);
    }
    this.store.video.reset(user);
    this.offers.delete(user);
  }
}
