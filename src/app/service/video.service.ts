import { Injectable } from '@angular/core';
import { runInAction } from 'mobx';
import { filter, firstValueFrom, map, mergeMap, Subject, switchMap, takeUntil, takeWhile, timer } from 'rxjs';
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
  watchUrl?: string;
}

function getSessionId(sdp: string): string {
  const match = sdp.match(/^o=\S+ (\d+) /m);
  return match?.[1] || '';
}

export type ConnectionType = 'cohost' | 'viewer';

@Injectable({
  providedIn: 'root',
})
export class VideoService {
  private destroy$ = new Subject<void>();
  poll = 30_000;
  fastPoll = 4_000;
  stuck = 30_000;
  maxInitial = 100;
  fanOutDegree = 2;

  url = '';

  lobbyWebsocket = false;
  peerWebsocket = false;

  private stream?: MediaStream;
  connectionTypes = new Map<string, ConnectionType>();
  private viewerTree = new Map<string, string[]>();
  private viewerParent = '';

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
    this.serveViewerTree(url);
  }

  /**
   * Join as a view-only participant (not in lobby)
   * Connects to fan-out tree, receives aggregated streams from parent
   */
  watch(url: string) {
    console.warn('Joining as viewer');
    this.destroy$.next();
    this.url = url;

    // Find optimal parent in the viewer tree
    this.connectToViewerTree(url);
  }

  hangup() {
    console.warn('Hung Up!');
    this.url = '';
    for (const user of this.store.video.peers.keys()) {
      this.ts.respond([setPublic(localTag(user)), '-plugin/user/video'], 'tag:/' + localTag(user))
        .subscribe();
    }
    this.store.video.hangup();
    this.connectionTypes.clear();
    this.viewerTree.clear();
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
        this.connectionTypes.delete(user);
        this.ts.respond([setPublic(localTag(user)), '-plugin/user/video'], 'tag:/' + localTag(user))
          .subscribe(() => this.invite());
      }
      console.log('connectionstatechange', peer.connectionState);
    });
    peer.addEventListener('track', (event) => {
      console.warn('Track received:', event.streams[0]?.id, event.track.readyState);
      const [remoteStream] = event.streams;
      this.store.video.addStream(user, remoteStream);
      this.onTrack(user, event.track, remoteStream);
    });
    this.stream?.getTracks().forEach(t => peer.addTrack(t, this.stream!));
    return peer;
  }

  offers = new Map<string, string>();
  invite() {
    const doInvite = async (user: string) => {
      runInAction(() => this.store.video.hungup.set(user, false));
      const checkStuck = () => timer(this.stuck).pipe(
        takeUntil(this.destroy$),
      ).subscribe(() => {
        const peer = this.store.video.peers.get(user);
        if (peer?.localDescription && !peer.remoteDescription) {
          console.error('Stuck!');
          this.store.video.reset(user);
          this.offers.delete(user);
          this.connectionTypes.delete(user);
          void doInvite(user);
        }
      });
      if (this.store.video.peers.has(user)) {
        checkStuck();
        return;
      }
      const peer = this.peer(user);
      this.connectionTypes.set(user, 'cohost');
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
        filter(url => url?.startsWith('tag:/')),
        switchMap(url => this.refs.getCurrent(url)),
        tap(res => {
          const user = getUserUrl(res);
          const hungup = !hasTag('plugin/user/lobby', res);
          runInAction(() => this.store.video.hungup.set(user, hungup));
          if (hungup && this.store.video.peers.has(user)) {
            console.warn('Hung Up!', user);
            this.store.video.remove(user);
            this.connectionTypes.delete(user);
          }
        }),
        filter(res => hasTag('plugin/user/lobby', res)),
        map(res => getUserUrl(res)),
        filter(user => !!user),
        filter(user => user !== this.store.account.tag),
        tap(user => {
          this.connectionTypes.set(user, 'cohost');
          this.peer(user);
        }),
        takeUntil(this.destroy$)
      ).subscribe((user: any) => doInvite(user));
    }
    timer(0, this.poll).pipe(
      takeWhile(() => !this.lobbyWebsocket),
      takeUntil(this.destroy$),
    ).subscribe(() => poll());
  }

  seen = new Map<string, Set<string>>();
  answer() {
    const doAnswer = async (res: Ref, allowUnknown: boolean) => {
      const user = getUserUrl(res);
      if (!user || user === this.store.account.tag) return;
      const video = res.plugins?.['plugin/user/video'] as VideoSignaling | undefined;
      if (!video) return;
      if (this.store.video.hungup.get(user)) return;
      let peer = this.store.video.peers.get(user);
      this.connectionTypes.set(user, 'cohost');
      if (peer?.connectionState === 'connected' && video.offer && !video.answer) {
        const newSessionId = getSessionId(video.offer.sdp!);
        const currentSessionId = peer?.remoteDescription
          ? getSessionId(peer.remoteDescription.sdp)
          : '';
        if (newSessionId !== currentSessionId) {
          console.warn('Peer reloaded - resetting connection', user);
          this.store.video.reset(user);
          this.offers.delete(user);
          this.connectionTypes.delete(user);
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
      if (!peer && !allowUnknown) return;
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
          if (this.seen.get(user)?.has(hash)) continue;
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
    ).subscribe(res => doAnswer(res, false));
    if (this.config.websockets) {
      poll();
      this.stomp.watchResponse('tag:/' + this.store.account.localTag).pipe(
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
    if (!scheduled) timer(throttle).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      for (const [u, o] of this.queue.entries()) {
        this.ts.patchResponse(['plugin/user/video'], 'tag:/' + localTag(u), o).subscribe();
      }
      this.queue.clear();
    });
  }

  /**
   * Co-hosts serve as roots of viewer sub-trees
   */
  private serveViewerTree(url: string) {
    // Initialize our viewer tree branch
    this.viewerTree.set(this.store.account.tag, []);

    // Publish our availability as a relay point
    this.updateTreeAvailability(url);

    // Listen for viewer connection requests
    this.answerViewers(url);
  }

  private updateTreeAvailability(url: string) {
    // Update our ref to indicate capacity for viewers
    const myChildren = this.viewerTree.get(this.store.account.tag) || [];
    const hasCapacity = myChildren.length < this.fanOutDegree;

    this.ts.mergeResponse(['plugin/user/video'], 'tag:/' + this.store.account.localTag, {
      plugins: {
        'plugin/user/video': {
          relay: {
            url,
            capacity: hasCapacity ? this.fanOutDegree - myChildren.length : 0,
            children: myChildren,
          }
        }
      }
    }).subscribe();
  }

  /**
   * Viewers connect to the tree structure
   */
  private connectToViewerTree(url: string) {
    // Find all potential relay points (co-hosts and their viewer children)
    this.refs.page({
      query: 'plugin/user/lobby',
      responses: url,
    }).pipe(
      map(page => page.content),
      takeUntil(this.destroy$)
    ).subscribe(async cohosts => {
      // Find optimal parent with capacity
      const parent = await this.findOptimalRelay(cohosts, url);
      if (!parent) {
        console.warn('No relay capacity available');
        return;
      }

      this.viewerParent = parent;
      this.connectionTypes.set(parent, 'viewer');

      // Connect to parent
      const peer = this.peer(parent);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      // Signal viewer connection request
      this.ts.mergeResponse(
        [setPublic(localTag(parent)), '-plugin/user/video/viewer', 'plugin/user/video/viewer'],
        'tag:/' + localTag(parent),
        { 'plugin/user/video/viewer': { offer, watchUrl: url } }
      ).subscribe();
    });
  }

  private async findOptimalRelay(cohosts: Ref[], url: string): Promise<string | null> {
    // BFS through co-hosts and their viewer trees
    for (const cohost of cohosts) {
      const user = getUserUrl(cohost);
      if (!user) continue;

      const relay = cohost.plugins?.['plugin/user/video']?.relay as any;
      if (relay?.capacity > 0) {
        return user;
      }

      // Check children of this cohost
      const children = relay?.children || [];
      for (const child of children) {
        const childCapacity = await this.checkViewerCapacity(child);
        if (childCapacity > 0) return child;
      }
    }
    return null;
  }

  private async checkViewerCapacity(user: string): Promise<number> {
    const ref = await firstValueFrom(this.refs.get(user));
    return ref?.plugins?.['plugin/user/video']?.relay?.capacity || 0;
  }

  /**
   * Answer viewer connection requests
   * Send aggregated streams from all co-hosts
   */
  private answerViewers(url: string) {
    const doAnswerViewer = async (res: Ref) => {
      const user = getUserUrl(res);
      if (!user || user === this.store.account.tag) return;

      const video = res.plugins?.['plugin/user/video/viewer'] as VideoSignaling | undefined;
      if (!video?.offer || video.watchUrl !== url) return;

      // Check capacity
      const myChildren = this.viewerTree.get(this.store.account.tag) || [];
      if (myChildren.length >= this.fanOutDegree) {
        console.warn('No capacity for viewer:', user);
        return;
      }

      const peer = this.peer(user);
      this.connectionTypes.set(user, 'viewer');

      await peer.setRemoteDescription(new RTCSessionDescription(video.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      // Add ALL cohost streams to this viewer connection
      this.forwardAllStreamsToViewer(peer, user);

      // Track as child
      myChildren.push(user);
      this.viewerTree.set(this.store.account.tag, myChildren);
      this.updateTreeAvailability(url);

      this.ts.mergeResponse(
        [setPublic(localTag(user)), '-plugin/user/video/viewer', 'plugin/user/video/viewer'],
        'tag:/' + localTag(user),
        { 'plugin/user/video/viewer': { answer, offer: video.offer } }
      ).subscribe();
    };

    const poll = () => this.refs.page({
      query: 'plugin/user/video/viewer',
      responses: 'tag:/' + this.store.account.localTag,
    }).pipe(
      mergeMap(page => page.content),
      filter(res => {
        const user = getUserUrl(res);
        return !!user && user !== this.store.account.tag && !this.store.video.peers.has(user);
      }),
    ).subscribe(res => doAnswerViewer(res));

    if (this.config.websockets) {
      poll();
      this.stomp.watchResponse('tag:/' + this.store.account.localTag).pipe(
        switchMap(url => this.refs.getCurrent(url)),
        filter(res => hasTag('plugin/user/video/viewer', res)),
        takeUntil(this.destroy$)
      ).subscribe(res => doAnswerViewer(res));
    }
    timer(0, this.poll).pipe(
      takeUntil(this.destroy$),
    ).subscribe(() => poll());
  }

  /**
   * Forward all cohost streams to a viewer
   * Viewers receive aggregated streams from their parent
   */
  private forwardAllStreamsToViewer(peer: RTCPeerConnection, viewer: string) {
    // Add my own stream
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        peer.addTrack(track, this.stream);
      }
    }

    // Add all other cohost streams
    for (const [user, streams] of this.store.video.streams.entries()) {
      if (this.connectionTypes.get(user) === 'cohost') {
        for (const stream of streams) {
          for (const track of stream.stream.getTracks()) {
            peer.addTrack(track, stream.stream);
          }
        }
      }
    }
  }

  /**
   * When a new cohost stream arrives, forward to all viewers
   */
  private onTrack(user: string, track: MediaStreamTrack, stream: MediaStream) {
    // Forward to all viewer children
    for (const viewer of this.viewerTree.get(this.store.account.tag) || []) {
      const peer = this.store.video.peers.get(viewer);
      if (peer && this.connectionTypes.get(viewer) === 'viewer') {
        // Check if track already forwarded
        const senders = peer.getSenders();
        const alreadyForwarding = senders.some(s => s.track?.id === track.id);
        if (!alreadyForwarding) {
          peer.addTrack(track, stream);
        }
      }
    }
  }
}
