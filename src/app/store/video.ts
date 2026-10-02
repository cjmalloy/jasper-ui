import { signal, untracked } from '@angular/core';

export class VideoStore {

  readonly enabled = signal(false);
  readonly stream = signal<MediaStream | undefined>(undefined);
  readonly activeSpeaker = signal('');
  /**
   * Mutating the returned Map will not notify. Use store methods instead.
   */
  readonly peers = signal<ReadonlyMap<string, RTCPeerConnection>>(new Map());
  /**
   * Mutating the returned Map will not notify. Use store methods instead.
   */
  readonly streams = signal<ReadonlyMap<string, readonly { readonly playing?: boolean, readonly stream: MediaStream }[]>>(new Map());
  /**
   * Mutating the returned Map will not notify. Use setHungup() instead.
   */
  readonly hungup = signal<ReadonlyMap<string, boolean>>(new Map());

  setHungup(user: string, value: boolean) {
    this.hungup.update(m => new Map(m).set(user, value));
  }

  call(user: string, peer: RTCPeerConnection) {
    this.peers.update(m => new Map(m).set(user, peer));
    this.streams.update(m => new Map(m).set(user, []));
  }

  addStream(user: string, stream: MediaStream) {
    this.streams.update(streams => {
      const existing = streams.get(user) || [];
      if (existing.length) console.warn('adding second stream');
      return new Map(streams).set(user, [{ stream }, ...existing.filter(s => s.stream.id !== stream.id)]);
    });
  }

  playing(user: string, id: string) {
    this.streams.update(streams => {
      const existing = streams.get(user);
      if (!existing?.some(s => s.stream.id === id)) return streams;
      return new Map(streams).set(user, existing.map(s => s.stream.id === id ? { ...s, playing: true } : s));
    });
  }

  refreshStreams(user: string) {
    this.streams.update(streams => {
      const existing = streams.get(user);
      return existing ? new Map(streams).set(user, [...existing]) : streams;
    });
  }

  refreshPeer(user: string) {
    this.peers.update(peers => peers.has(user) ? new Map(peers) : peers);
  }

  reset(user: string) {
    this.remove(user);
    this.streams.update(m => new Map(m).set(user, []));
  }

  remove(user: string) {
    this.peers.update(peers => {
      const peer = peers.get(user);
      if (peer) peer.close();
      const result = new Map(peers);
      result.delete(user);
      return result;
    });
    this.streams.update(streams => {
      const result = new Map(streams);
      result.delete(user);
      return result;
    });
  }

  hangup() {
    for (const peer of untracked(this.peers).values()) peer.close();
    this.peers.set(new Map());
    this.streams.set(new Map());
    this.hungup.set(new Map());
    untracked(this.stream)?.getTracks().forEach(t => t.stop());
  }
}
