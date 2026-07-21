/// <reference types="vitest/globals" />
import { DefaultUrlSerializer } from '@angular/router';

import { CustomUrlSerializer } from './app-routing.module';

describe('CustomUrlSerializer', () => {
  const serializer = new CustomUrlSerializer();

  it('serializes path query OR operators as commas', () => {
    const tree = new DefaultUrlSerializer().parse('/tag/one%7Ctwo?pageNumber=2');

    expect(serializer.serialize(tree)).toBe('/tag/one,two?pageNumber=2');
  });

  it('parses path query commas as OR operators', () => {
    const tree = serializer.parse('/tag/one,two');

    expect(tree.root.children.primary.segments[1].path).toBe('one|two');
  });

  it('continues to parse percent-encoded OR operators', () => {
    const tree = serializer.parse('/tag/one%7Ctwo');

    expect(tree.root.children.primary.segments[1].path).toBe('one|two');
  });
});
