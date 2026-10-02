import { signal, untracked, WritableSignal } from '@angular/core';

function mutate<T>(s: WritableSignal<T>, fn: (value: T) => void) {
  const value = untracked(s);
  fn(value);
  s.set(value);
}

export class VideoStore {

  readonly enabled = signal(false);
  readonly stream = signal<MediaStream | undefined>(undefined);
  readonly activeSpeaker = signal('');
  /**
   * Mutating the returned Map will not notify. Use store methods instead.
   */
  readonly peers = signal(new Map<string, RTCPeerConnection>(), { equal: () => false });
  /**
   * Mutating the returned Map will not notify. Use store methods instead.
   */
  readonly streams = signal(new Map<string, { playing?: boolean, stream: MediaStream }[]>(), { equal: () => false });
  /**
   * Mutating the returned Map will not notify. Use setHungup() instead.
   */
  readonly hungup = signal(new Map<string, boolean>(), { equal: () => false });

  setHungup(user: string, value: boolean) {
    mutate(this.hungup, m => m.set(user, value));
  }

  call(user: string, peer: RTCPeerConnection) {
    mutate(this.peers, m => m.set(user, peer));
    mutate(this.streams, m => m.set(user, []));
  }

  addStream(user: string, stream: MediaStream) {
    mutate(this.streams, streams => {
      if (!streams.get(user)?.length) {
        streams.set(user, [{ stream }]);
      } else {
        console.warn('adding second stream');
        streams.set(user, [{ stream }, ...streams.get(user)!.filter(s => s.stream.id !== stream.id)]);
      }
    });
  }

  playing(user: string, id: string) {
    mutate(this.streams, streams => streams.get(user)!.find(s => s.stream.id === id)!.playing = true);
  }

  reset(user: string) {
    this.remove(user);
    mutate(this.streams, m => m.set(user, []));
  }

  remove(user: string) {
    mutate(this.peers, peers => {
      const peer = peers.get(user);
      if (peer) peer.close();
      peers.delete(user);
    });
    mutate(this.streams, m => m.delete(user));
  }

  hangup() {
    mutate(this.peers, peers => {
      for (const peer of peers.values()) peer.close();
      peers.clear();
    });
    mutate(this.streams, m => m.clear());
    mutate(this.hungup, m => m.clear());
    untracked(this.stream)?.getTracks().forEach(t => t.stop());
  }
}
