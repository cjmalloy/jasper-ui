import { makeAutoObservable, observable } from 'mobx';

export class VideoStore {

  enabled = false;
  stream?: MediaStream = {} as any;
  peers = new Map<string, RTCPeerConnection>();
  streams = new Map<string, MediaStream[]>();

  constructor() {
    makeAutoObservable(this, {
      stream: observable.ref,
      peers: observable.shallow,
      streams: observable.shallow,
    });
    this.stream = undefined;
  }

  call(user: string, peer: RTCPeerConnection) {
    this.peers.set(user, peer);
  }

  addStream(user: string, stream: MediaStream) {
    if (!this.streams.get(user)) {
      this.streams.set(user, [stream]);
    } else if (!this.streams.get(user)?.find(s => s.id === stream.id)) {
      this.streams.set(user, [...this.streams.get(user)!, stream]);
    }
  }

  remove(user: string) {
    this.peers.get(user)?.close();
    this.peers.delete(user);
    this.streams.delete(user);
  }

  hangup() {
    for (const [user, peer] of this.peers) peer.close();
    this.peers.clear();
    this.streams.clear();
    this.stream?.getTracks().forEach(t => t.stop());
  }
}
