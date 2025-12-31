import { makeAutoObservable, observable } from 'mobx';

export class VideoStore {

  enabled = false;
  stream?: MediaStream = {} as any;
  peers = new Map<string, RTCPeerConnection>();
  streams = new Map<string, MediaStream[]>();
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
    if (!user) throw 'No user';
    this.peers.set(user, peer);
    this.streams.set(user, []);
  }

  addStream(user: string, stream: MediaStream) {
    if (!user) throw 'No user';
    if (!this.streams.get(user)?.length) {
      this.streams.set(user, [stream]);
    } else if (!this.streams.get(user)?.find(s => s.id === stream.id)) {
      console.warn('adding second stream');
      this.streams.set(user, [...this.streams.get(user)!, stream]);
    }
  }

  reset(user: string) {
    if (!user) throw 'No user';
    this.peers.get(user)?.close();
    this.streams.get(user)?.forEach(s => s.getTracks().forEach(t => t.stop()));
    this.peers.delete(user);
    this.streams.set(user, []);
  }

  remove(user: string) {
    if (!user) throw 'No user';
    this.peers.get(user)?.close();
    this.streams.get(user)?.forEach(s => s.getTracks().forEach(t => t.stop()));
    this.peers.delete(user);
    this.streams.delete(user);
  }

  hangup() {
    for (const [user, peer] of this.peers) peer.close();
    this.peers.clear();
    this.streams.clear();
    this.hungup.clear();
    this.stream?.getTracks().forEach(t => t.stop());
  }
}
