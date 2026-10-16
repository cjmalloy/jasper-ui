/// <reference types="vitest/globals" />
import { computed } from '@angular/core';
import { VideoStore } from './video';

describe('VideoStore immutable state', () => {
  const stream = (id: string) => ({ id } as MediaStream);

  it('publishes new maps when calling and setting hungup without changing snapshots', () => {
    const store = new VideoStore();
    const peers = store.peers();
    const streams = store.streams();
    const hungup = store.hungup();
    const users = computed(() => [...store.peers().keys()]);
    expect(users()).toEqual([]);

    const peer = { close: vi.fn() } as unknown as RTCPeerConnection;
    store.call('alice', peer);
    store.setHungup('alice', true);

    expect(users()).toEqual(['alice']);
    expect(peers.size).toBe(0);
    expect(streams.size).toBe(0);
    expect(hungup.size).toBe(0);
    expect(store.hungup().get('alice')).toBe(true);
  });

  it('copies stream arrays and items when adding and marking streams as playing', () => {
    const store = new VideoStore();
    store.addStream('alice', stream('first'));
    const previous = store.streams();
    const previousStreams = previous.get('alice')!;
    const playing = computed(() => store.streams().get('alice')?.filter(s => s.playing).length);
    expect(playing()).toBe(0);

    store.playing('alice', 'first');

    expect(playing()).toBe(1);
    expect(store.streams()).not.toBe(previous);
    expect(previousStreams[0].playing).toBeUndefined();
    expect(store.streams().get('alice')![0]).not.toBe(previousStreams[0]);

    store.addStream('alice', stream('second'));
    store.addStream('alice', stream('second'));
    expect(store.streams().get('alice')!.map(s => s.stream.id)).toEqual(['second', 'first']);
    expect(previousStreams.map(s => s.stream.id)).toEqual(['first']);
  });

  it('closes peers and clears or resets maps without clearing previous snapshots', () => {
    const store = new VideoStore();
    const peer = { close: vi.fn() } as unknown as RTCPeerConnection;
    const track = { stop: vi.fn() };
    store.stream.set({ getTracks: () => [track] } as unknown as MediaStream);
    store.call('alice', peer);
    store.addStream('alice', stream('first'));
    const peers = store.peers();
    const streams = store.streams();

    store.reset('alice');

    expect(peer.close).toHaveBeenCalledOnce();
    expect(store.peers().size).toBe(0);
    expect(store.streams().get('alice')).toEqual([]);
    expect(peers.get('alice')).toBe(peer);
    expect(streams.get('alice')).toHaveLength(1);

    store.call('bob', peer);
    store.setHungup('bob', true);
    const beforeHangup = store.peers();
    const hungup = store.hungup();
    store.hangup();

    expect(peer.close).toHaveBeenCalledTimes(2);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(store.peers().size).toBe(0);
    expect(store.streams().size).toBe(0);
    expect(store.hungup().size).toBe(0);
    expect(beforeHangup.has('bob')).toBe(true);
    expect(hungup.get('bob')).toBe(true);
  });
});
