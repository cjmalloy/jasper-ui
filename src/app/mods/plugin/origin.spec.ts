import { Ref } from '../../model/ref';
import { isReplicating } from './origin';

describe('OriginPlugin', () => {
  const ref = (origin: string, target: string, source = ''): Ref => ({
    url: 'spec:test',
    origin,
    plugins: {'+plugin/origin': {
        origin: target,
        remote: source,
      }
    }
  });
  const api = (url: string, origin = '') => new Map([[origin, url]]);
  it('isReplicating', () => {
    expect(isReplicating(ref('@other', '@main'), api('spec:test'))).toBeTruthy();
    expect(isReplicating(ref('@other', '@main'), api('spec:other'))).toBeFalsy();
    expect(isReplicating(ref('@other', '@main', '@mt'), api('spec:test', '@mt'))).toBeTruthy();
    expect(isReplicating(ref('@other', '@main', '@diff'), api('spec:test', '@mt'))).toBeFalsy();
  });
});
