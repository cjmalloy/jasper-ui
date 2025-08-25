import * as bencode from 'bencode-js';
import { Buffer } from 'buffer';
import { sha1 } from 'js-sha1';

export function decodeTorrentFile(file: File): Promise<{ hash: string, magnetUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const buffer = Buffer.from(arrayBuffer);
        const decoded = bencode.decode(buffer);

        // Extract the info hash
        const info = decoded.info;
        const infoBuffer = bencode.encode(info);
        const hash = sha1(infoBuffer).toUpperCase();

        // Create magnet URL
        let magnetUrl = `magnet:?xt=urn:btih:${hash}`;
        if (decoded.announce) {
          const tracker = encodeURIComponent(decoded.announce.toString('utf8'));
          magnetUrl += `&tr=${tracker}`;
        }

        resolve({ hash, magnetUrl });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
