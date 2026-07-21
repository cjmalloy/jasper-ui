import { decodeTorrentFile, hashTorrentInfo } from './torrent';

describe('Torrent Utils', () => {
  it('extracts a v1 info hash', async () => {
    const file = new File(
      [new TextEncoder().encode('d4:infod6:lengthi1e4:name4:testee')],
      'test.torrent',
      { type: 'application/x-bittorrent' },
    );

    await expect(decodeTorrentFile(file)).resolves.toMatchObject({
      hash: '26BBF26111E1F1F37DEF07E192B2597BDCC49F68',
      magnetUrl: 'magnet:?xt=urn:btih:26BBF26111E1F1F37DEF07E192B2597BDCC49F68',
    });
  });

  it('hashes non-ASCII pieces as bytes', () => {
    expect(hashTorrentInfo({
      length: 1,
      name: 'test',
      pieces: '\x00\x80\xFF',
    })).toBe('BAA706756BFB0B3852DE732C1FC06049B7D42C01');
  });

  it('rejects unsupported v2 torrents', async () => {
    const file = new File(
      [new TextEncoder().encode('d4:infod12:meta versioni2e4:name4:testee')],
      'v2.torrent',
      { type: 'application/x-bittorrent' },
    );

    await expect(decodeTorrentFile(file)).rejects.toThrow('BitTorrent v2 torrents are not supported');
  });
});
