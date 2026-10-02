import { signal, untracked, WritableSignal } from '@angular/core';

function mutate<T>(s: WritableSignal<T>, fn: (value: T) => void) {
  const value = untracked(s);
  fn(value);
  s.set(value);
}

export class VideoStore {

  private readonly _enabled = signal(false);
  private readonly _stream = signal<MediaStream | undefined>(undefined);
  private readonly _activeSpeaker = signal('');
  private readonly _peers = signal(new Map<string, RTCPeerConnection>(), { equal: () => false });
  private readonly _streams = signal(new Map<string, { playing?: boolean, stream: MediaStream }[]>(), { equal: () => false });
  private readonly _hungup = signal(new Map<string, boolean>(), { equal: () => false });

  get enabled() { return this._enabled(); }
  set enabled(value: boolean) { this._enabled.set(value); }

  get stream() { return this._stream(); }
  set stream(value: MediaStream | undefined) { this._stream.set(value); }

  get activeSpeaker() { return this._activeSpeaker(); }
  set activeSpeaker(value: string) { this._activeSpeaker.set(value); }

  /**
   * Mutating the returned Map will not notify. Use store methods instead.
   */
  get peers() { return this._peers(); }

  /**
   * Mutating the returned Map will not notify. Use store methods instead.
   */
  get streams() { return this._streams(); }

  /**
   * Mutating the returned Map will not notify. Use setHungup() instead.
   */
  get hungup() { return this._hungup(); }

  setHungup(user: string, value: boolean) {
    mutate(this._hungup, m => m.set(user, value));
  }

  call(user: string, peer: RTCPeerConnection) {
    mutate(this._peers, m => m.set(user, peer));
    mutate(this._streams, m => m.set(user, []));
  }

  addStream(user: string, stream: MediaStream) {
    mutate(this._streams, streams => {
      if (!streams.get(user)?.length) {
        streams.set(user, [{ stream }]);
      } else {
        console.warn('adding second stream');
        streams.set(user, [{ stream }, ...streams.get(user)!.filter(s => s.stream.id !== stream.id)]);
      }
    });
  }

  playing(user: string, id: string) {
    mutate(this._streams, streams => streams.get(user)!.find(s => s.stream.id === id)!.playing = true);
  }

  reset(user: string) {
    this.remove(user);
    mutate(this._streams, m => m.set(user, []));
  }

  remove(user: string) {
    mutate(this._peers, peers => {
      const peer = peers.get(user);
      if (peer) peer.close();
      peers.delete(user);
    });
    mutate(this._streams, m => m.delete(user));
  }

  hangup() {
    mutate(this._peers, peers => {
      for (const peer of peers.values()) peer.close();
      peers.clear();
    });
    mutate(this._streams, m => m.clear());
    mutate(this._hungup, m => m.clear());
    untracked(this._stream)?.getTracks().forEach(t => t.stop());
  }
}
