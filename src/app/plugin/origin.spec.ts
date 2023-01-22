import { Ref } from '../model/ref';
import { getMailbox, isMailbox, mailboxes, notifications } from './mailbox';
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
  it('isReplicating', () => {
    expect(isReplicating(ref('@other', '@main'), 'spec:test')).toBeTruthy();
    expect(isReplicating(ref('@other', '@main'), 'spec:other')).toBeFalsy();
    expect(isReplicating(ref('@other', '@main', '@mt'), 'spec:test', '@mt')).toBeTruthy();
    expect(isReplicating(ref('@other', '@main', '@diff'), 'spec:test', '@mt')).toBeFalsy();
  });
});
