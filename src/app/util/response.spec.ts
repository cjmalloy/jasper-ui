/// <reference types="vitest/globals" />
import { DateTime } from 'luxon';
import { isNewResponse } from './response';

describe('isNewResponse', () => {
  const created = DateTime.fromISO('2024-01-01T00:00:00.000Z');

  it('should accept a newly created Ref', () => {
    expect(isNewResponse({ url: 'comment:a', created, modified: created.plus({ milliseconds: 10 }) })).toBe(true);
  });

  it('should reject an edited Ref', () => {
    expect(isNewResponse({ url: 'comment:a', created, modified: created.plus({ minutes: 5 }) })).toBe(false);
  });
});
