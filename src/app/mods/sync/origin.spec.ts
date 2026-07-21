/// <reference types="vitest/globals" />
import { Ref } from '../../model/ref';
import { isReplicating } from './origin';

describe('OriginPlugin', () => {
  const ref = (url: string, origin: string, target: string, source = ''): Ref => ({
    url,
    origin,
    tags: ['+plugin/origin/pull'],
    plugins: {'+plugin/origin': {
        local: target,
        remote: source,
      }
    }
  });
  const api = (url: string, remote = '') => new Map([[url, remote]]);
  it('isReplicating', () => {
    expect(isReplicating('', ref('spec:test', '@other', '@main'), api('spec:test'))).toBeTruthy();
    expect(isReplicating('', ref('spec:test', '@other', '@main'), api('spec:other'))).toBeFalsy();
    expect(isReplicating('@mt', ref('spec:test', '@other', '@main', '@mt'), api('spec:test', '@mt'))).toBeTruthy();
    expect(isReplicating('@mt', ref('spec:test', '@other', '@main', '@diff'), api('spec:test', '@mt'))).toBeFalsy();
  });
});
