/// <reference types="vitest/globals" />
import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateTime } from 'luxon';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { Ref } from '../model/ref';
import { Store } from '../store/store';
import { localTag, setPublic } from '../util/tag';
import { AccountService, compareCursors } from './account.service';
import { AdminService } from './admin.service';
import { OriginMapService } from './origin-map.service';

/**
 * These specs run the real AccountService and OriginMapService against a tiny
 * in-memory Jasper server. Signing in again on the same server is a page
 * reload: every in-memory cursor is gone and must be loaded from the server.
 *
 * The server we talk to is called "main". We are +user/alice on main.
 *
 * Remote servers in these stories:
 * - repl: we pull it as @repl, and it pulls us back as @main, so replies to
 *   us on repl are tagged plugin/outbox/main/user/alice.
 * - town: we pull it as @town. It does not pull us.
 */
const MAIN = 'http://localhost:8081';
const REPL = 'http://repl:8081';
const TOWN = 'http://town:8081';
const CITY = 'http://city:8081';

describe('Notifications', () => {
  let server: FakeJasper;

  beforeEach(() => {
    server = new FakeJasper();
  });

  describe('origin mapping', () => {

    it('a remote that pulls us calls us by its own name for us', async () => {
      server.pull(REPL, '@repl');
      server.pull(MAIN, '@main', { into: '@repl' });

      const alice = await server.signIn('+user/alice');

      expect(alice.origins.localOrigin('@repl', '@main')).toBe('');
      expect(alice.store.account.outboxes()).toEqual(['plugin/outbox/main/user/alice@repl']);
    });

    it('a server we both pull is the same origin, whatever the remote calls it', async () => {
      server.pull(REPL, '@repl');
      server.pull(TOWN, '@town');
      server.pull(TOWN, '@village', { into: '@repl' });

      const alice = await server.signIn('+user/alice');

      expect(alice.origins.localOrigin('@repl', '@village')).toBe('@town');
    });

    it('a server only the remote pulls is not one of our origins', async () => {
      server.pull(REPL, '@repl');
      server.pull(CITY, '@city', { into: '@repl' });

      const alice = await server.signIn('+user/alice');

      expect(alice.origins.localOrigin('@repl', '@city')).toBeUndefined();
    });

    it('the same name for a different server is not the same origin', async () => {
      server.pull(REPL, '@repl');
      server.pull(TOWN, '@town');
      server.pull(CITY, '@town', { into: '@repl' });

      const alice = await server.signIn('+user/alice');

      expect(alice.origins.localOrigin('@repl', '@town')).toBeUndefined();
    });

    it('a remote origin always maps to itself', async () => {
      server.pull(REPL, '@repl');

      const alice = await server.signIn('+user/alice');

      expect(alice.origins.localOrigin('@repl')).toBe('@repl');
    });
  });

  describe('alias mapping', () => {

    it('an alias declared on our own origin Ref is trusted', async () => {
      server.pull(REPL, '@repl', { aliases: { '+user/alice': '+user/charlie' } });

      const alice = await server.signIn('+user/alice');

      expect(alice.store.account.aliasTags()).toEqual(['+user/charlie@repl']);
      expect(alice.store.account.aliasMailboxes()).toEqual(['plugin/inbox/user/charlie@repl']);
    });

    it('an alias declared only by the remote is not trusted', async () => {
      server.pull(REPL, '@repl');
      server.pull(MAIN, '@main', { into: '@repl', aliases: { '+user/charlie': '+user/alice' } });

      const alice = await server.signIn('+user/alice');

      expect(alice.store.account.aliasTags()).toEqual([]);
    });

    it('child tags of an aliased user are aliased too', async () => {
      server.pull(REPL, '@repl', { aliases: { '+user/alice': '+user/charlie' } });

      const work = await server.signIn('+user/alice/work');

      expect(work.store.account.aliasTags()).toEqual(['+user/charlie/work@repl']);
    });

    it('posts by our alias are not notifications for us', async () => {
      server.pull(REPL, '@repl', { aliases: { '+user/alice': '+user/charlie' } });
      server.post('comment:note-to-self', '@repl', ['+user/charlie', 'plugin/inbox/user/charlie']);

      const alice = await server.signIn('+user/alice');

      expect(await alice.badge()).toBe(0);
    });
  });

  describe('clearing', () => {

    it('a local notification stays cleared after reload', async () => {
      server.post('comment:hi', '', ['+user/bob', 'plugin/inbox/user/alice']);

      let alice = await server.signIn('+user/alice');
      expect(await alice.badge()).toBe(1);
      await alice.readInbox();
      expect(await alice.badge()).toBe(0);

      alice = await server.signIn('+user/alice');
      expect(await alice.badge()).toBe(0);
    });

    it('a reply from a remote that pulls us stays cleared after reload', async () => {
      server.pull(REPL, '@repl');
      server.pull(MAIN, '@main', { into: '@repl' });
      server.post('comment:reply', '@repl', ['+user/bob', 'plugin/outbox/main/user/alice']);

      let alice = await server.signIn('+user/alice');
      expect(await alice.badge()).toBe(1);
      await alice.readInbox();
      expect(await alice.badge()).toBe(0);

      alice = await server.signIn('+user/alice');
      expect(await alice.badge()).toBe(0);
    });

    it('a notification copied from a remote without a mailbox for us stays cleared after reload', async () => {
      server.pull(TOWN, '@town');
      server.post('comment:town-hall', '@town', ['+user/bob', 'plugin/inbox/user/alice']);

      let alice = await server.signIn('+user/alice');
      expect(await alice.badge()).toBe(1);
      await alice.readInbox();
      expect(await alice.badge()).toBe(0);

      alice = await server.signIn('+user/alice');
      expect(await alice.badge()).toBe(0);
    });

    it('opening a remote notification clears it, and it stays cleared after reload', async () => {
      server.pull(REPL, '@repl');
      server.pull(MAIN, '@main', { into: '@repl' });
      server.post('comment:reply', '@repl', ['+user/bob', 'plugin/outbox/main/user/alice']);

      let alice = await server.signIn('+user/alice');
      const [reply] = await alice.unread();
      await alice.open(reply);
      expect(await alice.badge()).toBe(0);

      alice = await server.signIn('+user/alice');
      expect(await alice.badge()).toBe(0);
    });

    it('clearing everything clears every origin, and it stays cleared after reload', async () => {
      server.pull(REPL, '@repl');
      server.pull(MAIN, '@main', { into: '@repl' });
      server.pull(TOWN, '@town');
      server.post('comment:hi', '', ['+user/bob', 'plugin/inbox/user/alice']);
      server.post('comment:reply', '@repl', ['+user/bob', 'plugin/outbox/main/user/alice']);
      server.post('comment:town-hall', '@town', ['+user/bob', 'plugin/inbox/user/alice']);

      let alice = await server.signIn('+user/alice');
      expect(await alice.badge()).toBe(3);
      await alice.clearAll();
      expect(await alice.badge()).toBe(0);

      alice = await server.signIn('+user/alice');
      expect(await alice.badge()).toBe(0);
    });

    it('a new notification after clearing is unread', async () => {
      server.pull(TOWN, '@town');
      server.post('comment:first', '@town', ['+user/bob', 'plugin/inbox/user/alice']);

      let alice = await server.signIn('+user/alice');
      await alice.readInbox();
      server.post('comment:second', '@town', ['+user/bob', 'plugin/inbox/user/alice']);

      alice = await server.signIn('+user/alice');
      expect((await alice.unread()).map(ref => ref.url)).toEqual(['comment:second']);
    });

    it('a notification for our alias stays cleared after reload', async () => {
      server.pull(REPL, '@repl', { aliases: { '+user/alice': '+user/charlie' } });
      server.post('comment:for-charlie', '@repl', ['+user/bob', 'plugin/inbox/user/charlie']);

      let alice = await server.signIn('+user/alice');
      expect(await alice.badge()).toBe(1);
      await alice.readInbox();
      expect(await alice.badge()).toBe(0);

      alice = await server.signIn('+user/alice');
      expect(await alice.badge()).toBe(0);
    });

    it('a newer cursor Ref with the same url in another origin does not hide our cursor', async () => {
      // alice on repl is also called alice, and also pulls town
      server.pull(REPL, '@repl');
      server.pull(TOWN, '@town');
      server.pull(TOWN, '@town', { into: '@repl' });
      server.post('comment:town-hall', '@town', ['+user/bob', 'plugin/inbox/user/alice']);

      let alice = await server.signIn('+user/alice');
      await alice.readInbox();
      expect(await alice.badge()).toBe(0);

      // alice clears town on repl later, and we pull her cursor Ref
      server.cursor('tag:/user/alice?url=tag:/plugin/outbox/town', '@repl', ['+user/alice'], server.tick());

      alice = await server.signIn('+user/alice');
      expect(await alice.badge()).toBe(0);
    });
  });

  describe('clearing as an alias', () => {

    it('our alias clearing its inbox on its own server clears it for us', async () => {
      server.pull(REPL, '@repl', { aliases: { '+user/alice': '+user/charlie' } });
      server.post('comment:for-charlie', '@repl', ['+user/bob', 'plugin/inbox/user/charlie']);
      // charlie read it on repl, and we pulled charlie's cursor Ref
      server.cursor('tag:/user/charlie?url=tag:/plugin/inbox', '@repl', ['+user/charlie'], server.tick());

      const alice = await server.signIn('+user/alice');

      expect(await alice.badge()).toBe(0);
      expect(await alice.unread()).toEqual([]);
    });

    it('our alias clearing an origin we both pull clears it for us', async () => {
      server.pull(REPL, '@repl', { aliases: { '+user/alice': '+user/charlie' } });
      server.pull(TOWN, '@town', { aliases: { '+user/alice': '+user/dan' } });
      server.pull(TOWN, '@village', { into: '@repl' });
      server.post('comment:for-dan', '@town', ['+user/bob', 'plugin/inbox/user/dan']);
      // charlie on repl aliases dan@village, and read it on repl
      server.cursor('tag:/user/charlie?url=tag:/plugin/outbox/village', '@repl', ['+user/charlie'], server.tick());

      const alice = await server.signIn('+user/alice');

      expect(await alice.badge()).toBe(0);
    });

    it('our alias clearing an origin we do not pull clears nothing for us', async () => {
      server.pull(REPL, '@repl', { aliases: { '+user/alice': '+user/charlie' } });
      server.pull(TOWN, '@town', { aliases: { '+user/alice': '+user/dan' } });
      server.pull(CITY, '@town', { into: '@repl' });
      server.post('comment:for-dan', '@town', ['+user/bob', 'plugin/inbox/user/dan']);
      server.cursor('tag:/user/charlie?url=tag:/plugin/outbox/town', '@repl', ['+user/charlie'], server.tick());

      const alice = await server.signIn('+user/alice');

      expect(await alice.badge()).toBe(1);
    });

    it('our alias clearing one origin never clears another, even with a later clock', async () => {
      server.pull(REPL, '@repl', { aliases: { '+user/alice': '+user/charlie' } });
      server.pull(TOWN, '@town', { aliases: { '+user/alice': '+user/dan' } });
      server.post('comment:for-dan', '@town', ['+user/bob', 'plugin/inbox/user/dan']);
      server.cursor('tag:/user/charlie?url=tag:/plugin/inbox', '@repl', ['+user/charlie'], '2099-01-01T00:00:00.000000Z');

      const alice = await server.signIn('+user/alice');

      expect(await alice.badge()).toBe(1);
    });

    it('our alias with the same name as us still clears for us', async () => {
      server.pull(REPL, '@repl', { aliases: { '+user/alice': '+user/alice' } });
      server.post('comment:for-alice', '@repl', ['+user/bob', 'plugin/inbox/user/alice']);
      // alice on repl read it, then alice on main read something else later
      server.cursor('tag:/user/alice?url=tag:/plugin/inbox', '@repl', ['+user/alice'], server.tick());
      server.cursor('tag:/user/alice?url=tag:/plugin/inbox', '', ['+user/alice'], server.tick());

      const alice = await server.signIn('+user/alice');

      expect(await alice.badge()).toBe(0);
    });

    it('alarms are never cleared by an alias', async () => {
      server.pull(REPL, '@repl', { aliases: { '+user/alice': '+user/charlie' } });
      server.post('comment:for-charlie', '@repl', ['+user/bob', 'plugin/inbox/user/charlie']);
      server.post('comment:fire', '@repl', ['+user/bob', 'fire']);
      server.cursor('tag:/user/charlie?url=tag:/plugin/inbox', '@repl', ['+user/charlie'], server.tick());

      const alice = await server.signIn('+user/alice', { alarms: ['fire'] });

      expect((await alice.unread()).map(ref => ref.url)).toEqual(['comment:fire']);
    });

    it('several aliases on one origin use the latest cursor', async () => {
      server.pull(REPL, '@repl', { aliases: { '+user/alice': ['+user/charlie', '+user/carol'] } });
      server.post('comment:old', '@repl', ['+user/bob', 'plugin/inbox/user/charlie']);
      server.cursor('tag:/user/charlie?url=tag:/plugin/inbox', '@repl', ['+user/charlie'], server.tick());
      server.post('comment:new', '@repl', ['+user/bob', 'plugin/inbox/user/carol']);
      server.cursor('tag:/user/carol?url=tag:/plugin/inbox', '@repl', ['+user/carol'], server.tick());

      const alice = await server.signIn('+user/alice');

      expect(await alice.badge()).toBe(0);
    });

    it('an alias without a cursor Ref leaves our own cursor in charge', async () => {
      server.pull(REPL, '@repl', { aliases: { '+user/alice': '+user/charlie' } });
      server.post('comment:old', '@repl', ['+user/bob', 'plugin/inbox/user/charlie']);

      let alice = await server.signIn('+user/alice');
      await alice.readInbox();
      server.post('comment:new', '@repl', ['+user/bob', 'plugin/inbox/user/charlie']);

      alice = await server.signIn('+user/alice');
      expect((await alice.unread()).map(ref => ref.url)).toEqual(['comment:new']);
    });

    it('an alias cursor Ref we may not read leaves our own cursor in charge', async () => {
      server.pull(REPL, '@repl', { aliases: { '+user/alice': '+user/charlie' } });
      server.post('comment:for-charlie', '@repl', ['+user/bob', 'plugin/inbox/user/charlie']);
      server.cursor('tag:/user/charlie?url=tag:/plugin/inbox', '@repl', ['+user/charlie'], server.tick());
      server.forbid('plugin/user/cursor:(+user/charlie@repl)');

      const alice = await server.signIn('+user/alice');

      expect(await alice.badge()).toBe(1);
    });
  });
});

/**
 * Session of the real client services, signed in to a FakeJasper server.
 */
class Session {
  readonly account = TestBed.inject(AccountService);
  readonly origins = TestBed.inject(OriginMapService);
  readonly store = TestBed.inject(Store);

  /**
   * Notification badge count.
   */
  async badge() {
    this.account.checkNotifications();
    await settle();
    return this.store.account.notifications();
  }

  async unread(): Promise<Ref[]> {
    return (await firstValueFrom(this.account.notificationPage$(100))).content;
  }

  /**
   * Same as visiting the unread page and leaving it.
   */
  async readInbox() {
    const readThrough = new Map<string, string>();
    for (const ref of await this.unread()) {
      const current = readThrough.get(ref.origin || '');
      if (!current || compareCursors(ref.modifiedString!, current) > 0) readThrough.set(ref.origin || '', ref.modifiedString!);
    }
    await Promise.all(Array.from(readThrough, ([origin, cursor]) => this.account.clearNotifications(cursor, [origin])));
  }

  /**
   * Same as opening a notification.
   */
  async open(ref: Ref) {
    this.account.clearNotificationsIfNone(ref.modified, ref.origin);
    await settle();
  }

  async clearAll() {
    await this.account.clearNotifications();
  }
}

async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

interface PullOptions {
  /**
   * Origin the origin Ref was pulled into. Defaults to our origin.
   */
  into?: string;
  /**
   * Local user -> remote user(s).
   */
  aliases?: Record<string, string | string[]>;
}

/**
 * In-memory Jasper server with just enough of the API for notifications:
 * - query: tags, child tags, exact origins (@ is the default origin), !, :, | and one level of ()
 * - obsolete: only the newest Ref with a url is not obsolete, and page and count
 *   only return Refs that are not obsolete unless obsolete is null
 * - user response Refs: tag:/user/alice?url=... in the signed in user's origin
 */
class FakeJasper {
  private refs: Ref[] = [];
  private forbidden = new Set<string>();
  private clock = 0;
  private user = '';
  private origin = '';

  async signIn(user: string, config: { alarms?: string[] } = {}, origin = ''): Promise<Session> {
    this.user = user;
    this.origin = origin;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([this.interceptor])),
        provideRouter([]),
      ],
    });
    const admin = TestBed.inject(AdminService);
    vi.spyOn(admin, 'getPlugin').mockImplementation((tag: string) =>
      ['+plugin/origin', 'plugin/user/cursor'].includes(tag) ? { tag } as any : undefined);
    vi.spyOn(admin, 'getTemplate').mockImplementation((tag: string) =>
      tag === 'user' ? { tag } as any : undefined);
    const store = TestBed.inject(Store);
    store.account.tag.set(user);
    store.account.origin.set(origin);
    store.account.ext.set({ tag: user, origin, config });
    await firstValueFrom(TestBed.inject(OriginMapService).init$);
    return new Session();
  }

  /**
   * Server time, always later than the last call.
   */
  tick() {
    return DateTime.fromISO('2026-01-01T00:00:00Z', { zone: 'utc' })
      .plus({ seconds: ++this.clock })
      .toFormat(`yyyy-MM-dd'T'HH:mm:ss.SSS`) + '001Z';
  }

  pull(url: string, local: string, options: PullOptions = {}) {
    const aliases = Object.entries(options.aliases || {})
      .flatMap(([local, remotes]) => [remotes].flat().map(remote => ({ local, remote })));
    this.save({
      url,
      origin: options.into || '',
      tags: ['+plugin/origin', '+plugin/origin/pull'],
      plugins: { '+plugin/origin': { local, ...(aliases.length ? { aliases } : {}) } },
    });
  }

  post(url: string, origin: string, tags: string[]) {
    this.save({ url, origin, tags });
  }

  cursor(url: string, origin: string, tags: string[], cursor: string) {
    this.save({
      url,
      origin,
      tags: ['internal', 'plugin/user/cursor', ...tags],
      plugins: { 'plugin/user/cursor': { cursor } },
    });
  }

  /**
   * Respond 403 to page requests for this query.
   */
  forbid(query: string) {
    this.forbidden.add(query);
  }

  private save(ref: Ref, modified = this.tick()) {
    this.refs = this.refs.filter(r => r.url !== ref.url || (r.origin || '') !== (ref.origin || ''));
    this.refs.push({ ...ref, modified: modified as any });
  }

  private readonly interceptor: HttpInterceptorFn = req => this.handle(req);

  private handle(req: HttpRequest<any>): Observable<HttpEvent<any>> {
    const path = req.url.substring(req.url.indexOf('/api/v1/'));
    const param = (name: string) => req.params.get(name) ?? undefined;
    const ok = (body: any) => of(new HttpResponse({ status: 200, body: JSON.parse(JSON.stringify(body)) }));
    const error = (status: number) => throwError(() => new HttpErrorResponse({ status, url: req.url }));
    if (req.method === 'GET' && path === '/api/v1/ref/page') {
      if (this.forbidden.has(param('query')!)) return error(403);
      const all = this.find(req);
      const size = +(param('size') || 20);
      const page = +(param('page') || 0);
      return ok({
        content: all.slice(page * size, (page + 1) * size),
        page: { number: page, size, totalElements: all.length, totalPages: Math.ceil(all.length / size) },
      });
    }
    if (req.method === 'GET' && path === '/api/v1/ref/count') {
      if (this.forbidden.has(param('query')!)) return error(403);
      return ok('' + this.find(req).length);
    }
    if (req.method === 'PATCH' && path === '/api/v1/ref') {
      const ref = this.refs.find(r => r.url === param('url') && (r.origin || '') === (param('origin') || ''));
      if (!ref) return error(404);
      if (ref.modified as any !== param('cursor')) return error(409);
      applyPatch(ref, req.body);
      ref.modified = this.tick() as any;
      return ok(ref.modified);
    }
    if (req.method === 'GET' && path === '/api/v1/tags/response') {
      return ok(this.response(param('url')!));
    }
    if (req.method === 'PATCH' && path === '/api/v1/tags/response') {
      const ref = this.response(param('url')!);
      ref.tags = [...new Set([...ref.tags || [], ...req.params.getAll('tags') || []])];
      if (req.headers.get('Content-Type') === 'application/merge-patch+json') {
        ref.plugins = { ...ref.plugins, ...req.body };
      } else {
        applyPatch(ref, req.body);
      }
      ref.modified = this.tick() as any;
      return ok(null);
    }
    throw `FakeJasper does not support ${req.method} ${path}`;
  }

  private response(url: string): Ref {
    const userUrl = `tag:/${setPublic(localTag(this.user))}?url=${url}`;
    let ref = this.refs.find(r => r.url === userUrl && (r.origin || '') === this.origin);
    if (!ref) {
      this.save({ url: userUrl, origin: this.origin, tags: ['internal', this.user] });
      ref = this.refs.find(r => r.url === userUrl && (r.origin || '') === this.origin)!;
    }
    return ref;
  }

  private find(req: HttpRequest<any>): Ref[] {
    const query = req.params.get('query');
    const after = req.params.get('modifiedAfter');
    const before = req.params.get('modifiedBefore');
    const obsolete = req.params.get('obsolete');
    const sort = req.params.getAll('sort') || [];
    const result = this.refs
      .filter(ref => !query || matches(query, ref))
      .filter(ref => !after || compareCursors(ref.modified as any, after) > 0)
      .filter(ref => !before || compareCursors(ref.modified as any, before) < 0)
      .filter(ref => obsolete === null || (obsolete === 'true') === this.obsolete(ref));
    if (sort.includes('modified,ASC')) result.sort((a, b) => compareCursors(a.modified as any, b.modified as any));
    return result;
  }

  private obsolete(ref: Ref) {
    return this.refs.some(r => r !== ref && r.url === ref.url && compareCursors(r.modified as any, ref.modified as any) > 0);
  }
}

function matches(query: string, ref: Ref): boolean {
  return split(query, '|').some(and => split(and, ':').every(term => termMatches(term, ref)));
}

function termMatches(term: string, ref: Ref): boolean {
  if (term.startsWith('!')) return !termMatches(term.substring(1), ref);
  if (term.startsWith('(')) return matches(term.substring(1, term.length - 1), ref);
  const at = term.indexOf('@');
  const tag = at < 0 ? term : term.substring(0, at);
  const origin = at < 0 ? undefined : term.substring(at) === '@' ? '' : term.substring(at);
  if (origin !== undefined && (ref.origin || '') !== origin) return false;
  return !tag || !!ref.tags?.some(t => t === tag || t.startsWith(tag + '/'));
}

/**
 * Split on a separator outside of parentheses.
 */
function split(query: string, separator: string): string[] {
  const result = [''];
  let depth = 0;
  for (const c of query) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === separator && !depth) {
      result.push('');
    } else {
      result[result.length - 1] += c;
    }
  }
  return result;
}

function applyPatch(target: any, ops: { op: string, path: string, value: any }[]) {
  for (const op of ops) {
    if (op.op !== 'add') throw `FakeJasper does not support patch op ${op.op}`;
    const keys = op.path.split('/').slice(1).map(key => key.replace(/~1/g, '/').replace(/~0/g, '~'));
    let parent = target;
    for (const key of keys.slice(0, -1)) parent = parent[key] ||= {};
    parent[keys[keys.length - 1]] = op.value;
  }
}
