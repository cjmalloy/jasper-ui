/// <reference types="vitest/globals" />
import { DefaultUrlSerializer, UrlSegment, UrlSegmentGroup, UrlTree } from '@angular/router';

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

  describe('browse', () => {
    const browse = (url: string, subview?: string, queryParams = {}, fragment?: string) =>
      new UrlTree(
        new UrlSegmentGroup([], {
          primary: new UrlSegmentGroup([
            new UrlSegment('browse', {}),
            new UrlSegment(url, {}),
            ...(subview ? [new UrlSegment(subview, {})] : []),
          ], {}),
        }),
        queryParams,
        fragment ?? null,
      );

    const roundTrip = (tree: UrlTree) => serializer.parse(serializer.serialize(tree));

    const paths = (tree: UrlTree) => tree.root.children.primary.segments.map(s => s.path);

    for (const url of [
      'wiki:Homepage',
      'tag:/science@',
      'isbn:9780262033848',
      'comment:3a4b5c',
      'https://example.com',
      'https://example.com/',
      'https://example.com/path/',
      'https://example.com/a?b=c',
      'https://example.com/a#d',
      'https://example.com/a?b=c&origin=@x#d',
    ]) {
      it(`round-trips ${url}`, () => {
        const tree = roundTrip(browse(url));

        expect(paths(tree)).toEqual(['browse', url]);
        expect(tree.queryParams).toEqual({});
        expect(tree.fragment).toBeNull();
      });
    }

    it('serializes plain browse links without encoding', () => {
      expect(serializer.serialize(browse('https://example.com/a?b=c#d'))).toBe('/browse/https://example.com/a?b=c#d');
    });

    it('parses the entire path tail as the url', () => {
      const tree = serializer.parse('/browse/https://example.com/path/?b=c#d');

      expect(paths(tree)).toEqual(['browse', 'https://example.com/path/?b=c#d']);
      expect(tree.queryParams).toEqual({});
      expect(tree.fragment).toBeNull();
    });

    it('round-trips router query params', () => {
      const tree = roundTrip(browse('https://example.com/a?b=c', undefined, { origin: '@x' }));

      expect(paths(tree)).toEqual(['browse', 'https://example.com/a?b=c']);
      expect(tree.queryParams).toEqual({ origin: '@x' });
    });

    it('round-trips router fragments', () => {
      const tree = roundTrip(browse('https://example.com/a#d', undefined, {}, 'top'));

      expect(paths(tree)).toEqual(['browse', 'https://example.com/a#d']);
      expect(tree.fragment).toBe('top');
    });

    it('round-trips subviews', () => {
      const tree = roundTrip(browse('https://example.com/', 'comments'));

      expect(paths(tree)).toEqual(['browse', 'https://example.com/', 'comments']);
      expect(tree.queryParams).toEqual({});
    });

    it('round-trips subviews with router query params', () => {
      const tree = roundTrip(browse('tag:/science@', 'thread', { origin: '@x' }));

      expect(paths(tree)).toEqual(['browse', 'tag:/science@', 'thread']);
      expect(tree.queryParams).toEqual({ origin: '@x' });
    });

    it('round-trips escaped subviews with router query params and fragments', () => {
      const original = browse('https://example.com/a?b=c#d', 'comments', { origin: '@x' }, 'top');
      expect(serializer.serialize(original)).toMatch(/^\/browse\/e\//);

      const tree = roundTrip(original);

      expect(paths(tree)).toEqual(['browse', 'https://example.com/a?b=c#d', 'comments']);
      expect(tree.queryParams).toEqual({ origin: '@x' });
      expect(tree.fragment).toBe('top');
    });

    it('parses raw urls containing /e/', () => {
      const tree = serializer.parse('/browse/https://example.com/e/foo');

      expect(paths(tree)).toEqual(['browse', 'https://example.com/e/foo']);
    });

    it('round-trips escaped urls containing /e/', () => {
      const original = browse('https://example.com/e/foo', undefined, { origin: '@x' });
      expect(serializer.serialize(original)).toMatch(/^\/browse\/e\//);

      const tree = roundTrip(original);

      expect(paths(tree)).toEqual(['browse', 'https://example.com/e/foo']);
      expect(tree.queryParams).toEqual({ origin: '@x' });
    });

    it('round-trips tag urls with an origin', () => {
      expect(paths(roundTrip(browse('tag:/science@remote')))).toEqual(['browse', 'tag:/science@remote']);

      const tree = roundTrip(browse('tag:/science@remote', undefined, { origin: '@remote' }));

      expect(paths(tree)).toEqual(['browse', 'tag:/science@remote']);
      expect(tree.queryParams).toEqual({ origin: '@remote' });
    });

    it('round-trips trailing slash urls with router query params', () => {
      const tree = roundTrip(browse('https://example.com/', undefined, { origin: '@x' }));

      expect(paths(tree)).toEqual(['browse', 'https://example.com/']);
      expect(tree.queryParams).toEqual({ origin: '@x' });
    });
  });
});
