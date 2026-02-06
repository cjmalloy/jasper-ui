import { signal } from '@angular/core';

export class VideoStore {

  private _enabled = signal(false);
  private _stream = signal<MediaStream | undefined>(undefined);
  private _activeSpeaker = signal('');
  private _peers = signal(new Map<string, RTCPeerConnection>());
  private _streams = signal(new Map<string, { playing?: boolean, stream: MediaStream }[]>());
  private _hungup = signal(new Map<string, boolean>());

  get enabled() { return this._enabled(); }
  set enabled(value: boolean) { this._enabled.set(value); }

  get stream() { return this._stream(); }
  set stream(value: MediaStream | undefined) { this._stream.set(value); }

  get activeSpeaker() { return this._activeSpeaker(); }
  set activeSpeaker(value: string) { this._activeSpeaker.set(value); }

  get peers() { return this._peers(); }
  set peers(value: Map<string, RTCPeerConnection>) { this._peers.set(value); }

  get streams() { return this._streams(); }
  set streams(value: Map<string, { playing?: boolean, stream: MediaStream }[]>) { this._streams.set(value); }

  get hungup() { return this._hungup(); }
  set hungup(value: Map<string, boolean>) { this._hungup.set(value); }

  call(user: string, peer: RTCPeerConnection) {
    const newPeers = new Map(this._peers());
    newPeers.set(user, peer);
    this._peers.set(newPeers);

    const newStreams = new Map(this._streams());
    newStreams.set(user, []);
    this._streams.set(newStreams);
  }

  addStream(user: string, stream: MediaStream) {
    const newStreams = new Map(this._streams());
    if (!newStreams.get(user)?.length) {
      newStreams.set(user, [{ stream }]);
    } else {
      console.warn('adding second stream');
      newStreams.set(user, [{ stream }, ...newStreams.get(user)!.filter(s => s.stream.id !== stream.id)]);
    }
    this._streams.set(newStreams);
  }

  playing(user: string, id: string) {
    const newStreams = new Map(this._streams());
    const userStreams = newStreams.get(user);
    if (userStreams) {
      const found = userStreams.find(s => s.stream.id === id);
      if (found) found.playing = true;
    }
    this._streams.set(newStreams);
  }

  reset(user: string) {
    this.remove(user);
    const newStreams = new Map(this._streams());
    newStreams.set(user, []);
    this._streams.set(newStreams);
  }

  remove(user: string) {
    const peer = this._peers().get(user);
    if (peer) peer.close();

    const newPeers = new Map(this._peers());
    newPeers.delete(user);
    this._peers.set(newPeers);

    const newStreams = new Map(this._streams());
    newStreams.delete(user);
    this._streams.set(newStreams);
  }

  hangup() {
    for (const peer of this._peers().values()) peer.close();
    this._peers.set(new Map());
    this._streams.set(new Map());
    this._hungup.set(new Map());
    this._stream()?.getTracks().forEach(t => t.stop());
  }
}
