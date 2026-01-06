import { makeAutoObservable, observable } from 'mobx';

export type VideoEventListeners = {
  icecandidate: (event: RTCPeerConnectionIceEvent) => void;
  icecandidateerror: (event: RTCPeerConnectionIceErrorEvent) => void;
  connectionstatechange: (event: Event) => void;
  track: (event: RTCTrackEvent) => void;
};

export class VideoStore {

  enabled = false;
  stream?: MediaStream = {} as any;
  activeSpeaker = '';
  peers = new Map<string, RTCPeerConnection>();
  streams = new Map<string, { playing?: boolean, stream: MediaStream }[]>();
  hungup = new Map<string, boolean>();
  listeners = new Map<string, VideoEventListeners>();

  constructor() {
    makeAutoObservable(this, {
      stream: observable.ref,
      peers: observable.shallow,
      streams: observable.shallow,
      hungup: observable.shallow,
      listeners: observable.shallow,
    });
    this.stream = undefined;
  }

  call(user: string, peer: RTCPeerConnection) {
    this.peers.set(user, peer);
    this.streams.set(user, []);
  }

  setListeners(user: string, listeners: VideoEventListeners) {
    this.listeners.set(user, listeners);
  }

  addStream(user: string, stream: MediaStream) {
    if (!this.streams.get(user)?.length) {
      this.streams.set(user, [{ stream }]);
    } else if (!this.streams.get(user)?.find(s => s.stream.id === stream.id)) {
      console.warn('adding second stream');
      this.streams.set(user, [...this.streams.get(user)!, { stream }]);
    }
  }

  playing(user: string, id: string) {
    this.streams.get(user)!.find(s => s.stream.id === id)!.playing = true;
  }

  reset(user: string) {
    this.remove(user);
    this.streams.set(user, []);
  }

  private removeListeners(user: string, peer: RTCPeerConnection) {
    const listeners = this.listeners.get(user);
    if (listeners) {
      peer.removeEventListener('icecandidate', listeners.icecandidate);
      peer.removeEventListener('icecandidateerror', listeners.icecandidateerror);
      peer.removeEventListener('connectionstatechange', listeners.connectionstatechange);
      peer.removeEventListener('track', listeners.track);
    }
  }

  remove(user: string) {
    const peer = this.peers.get(user);
    if (peer) {
      this.removeListeners(user, peer);
      peer.close();
      this.listeners.delete(user);
    }
    this.peers.delete(user);
    this.streams.delete(user);
  }

  hangup() {
    for (const [user, peer] of this.peers.entries()) {
      this.removeListeners(user, peer);
      peer.close();
    }
    this.peers.clear();
    this.streams.clear();
    this.hungup.clear();
    this.listeners.clear();
    this.stream?.getTracks().forEach(t => t.stop());
  }
}
