import { makeAutoObservable, observable } from 'mobx';

export class VideoStore {

  enabled = false;
  stream?: MediaStream = {} as any;
  activeSpeaker = '';
  peers = new Map<string, RTCPeerConnection>();
  streams = new Map<string, { playing?: boolean, stream: MediaStream }[]>();
  hungup = new Map<string, boolean>();

  constructor() {
    makeAutoObservable(this, {
      stream: observable.ref,
      peers: observable.shallow,
      streams: observable.shallow,
      hungup: observable.shallow,
    });
    this.stream = undefined;
  }

  call(user: string, peer: RTCPeerConnection) {
    this.peers.set(user, peer);
    this.streams.set(user, []);
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

  remove(user: string) {
    const peer = this.peers.get(user);
    if (peer) {
      peer.close();
      peer.removeAllListeners!('icecandidate');
      peer.removeAllListeners!('icecandidateerror');
      peer.removeAllListeners!('connectionstatechange');
      peer.removeAllListeners!('track');
    }
    this.peers.delete(user);
    this.streams.delete(user);
  }

  hangup() {
    for (const peer of this.peers.values()) {
      peer.close();
      peer.removeAllListeners!('icecandidate');
      peer.removeAllListeners!('icecandidateerror');
      peer.removeAllListeners!('connectionstatechange');
      peer.removeAllListeners!('track');
    }
    this.peers.clear();
    this.streams.clear();
    this.hungup.clear();
    this.stream?.getTracks().forEach(t => t.stop());
  }
}
