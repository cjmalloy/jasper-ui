import { Component, computed, DestroyRef, ElementRef, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { isEqual } from 'lodash-es';
import { catchError, Observable, of, startWith, switchMap } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { VisibilityService } from '../../service/visibility.service';
import { Store } from '../../store/store';
import { formatAuthor } from '../../util/format';
import { getPath, parseBookmarkParams } from '../../util/http';
import { hasPrefix } from '../../util/tag';

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss'],
  imports: [RouterLink]
})
export class NavComponent {
  private config = inject(ConfigService);
  private admin = inject(AdminService);
  private store = inject(Store);
  private refs = inject(RefService);
  private ts = inject(TaggingService);
  private editor = inject(EditorService);
  private vis = inject(VisibilityService);
  private el = inject(ElementRef);

  private destroyRef = inject(DestroyRef);

  readonly origin = input('');
  readonly url = input('');
  readonly titleInput = input('', { alias: 'title' });
  readonly title = computed(() => {
    const tag = this.previewTag();
    if (this.titleInput() || tag === undefined) return this.titleInput() || this.preview()?.tag || '';
    return this.user() ? formatAuthor(tag) : tag ? '#' + tag : '';
  });
  readonly textInput = input('', { alias: 'text' });
  readonly text = computed(() => {
    const tag = this.previewTag();
    if (tag === undefined) return this.textInput();
    return this.preview()?.name || this.textInput() || (this.user() ? formatAuthor(tag) : tag && !tag.startsWith('@') ? '#' + tag : tag);
  });
  readonly css = input('');
  readonly external = input(false);
  readonly shortUser = input(false);

  private readonly exists = toSignal(toObservable(computed(() =>
    this.url() && !this.localUrl() && !this.external() ? this.url() : undefined,
  )).pipe(switchMap(url => !url ? of(false) : new Observable<void>(subscriber => {
    this.vis.notifyVisible(this.el, () => subscriber.next());
  }).pipe(switchMap(() => this.refs.exists(url).pipe(catchError(() => of(false)))), startWith(false)))), { initialValue: false });
  readonly nav = computed(() => {
    if (!this.localUrl()) return this.exists() ? [this.store.view.refPath(), this.url()] : undefined;
    const nav = this.getNav();
    if (nav[0] === '/tag' && this.store.view.browser()) {
      const url = this.url();
      const suffixIndex = url.search(/[?#]/);
      const suffix = suffixIndex < 0 ? '' : url.substring(suffixIndex);
      return ['/browse', 'tag:/' + nav[1] + suffix];
    }
    return nav;
  });
  private readonly previewTag = computed(() => {
    const nav = this.localUrl() ? this.getNav() : undefined;
    return nav?.[0] === '/tag' && !this.external() && !this.meaningfulText(this.textInput())
      ? nav[1] as string : undefined;
  });
  private readonly user = computed(() => {
    const tag = this.previewTag();
    return !!tag && this.shortUser() && hasPrefix(tag, 'user');
  });
  private readonly preview = toSignal(toObservable(computed(() => ({
    tag: this.previewTag(),
    origin: this.origin(),
    user: this.user(),
  }), { equal: isEqual })).pipe(switchMap(({ tag, origin, user }) => tag
    ? this.editor.getTagPreview(tag, origin, true, !user).pipe(startWith(undefined))
    : of(undefined))),
  { initialValue: undefined });
  private readonly baseHref = document.getElementsByTagName('base')[0]?.href || document.baseURI || location.origin + '/';


  getNav() {
    const url = this.url();
    if (url.toLowerCase().startsWith('tag:/')) {
      return ['/tag', getPath(url.substring('tag:'.length))!.substring(1)];
    }
    let path = getPath(url) || '';
    const basePath = getPath(this.baseHref)!;
    if (path.startsWith(basePath)) {
      path = path.substring(basePath.length);
    }
    if (path.startsWith('/')) {
      path = path.substring(1);
    }
    const parts = path.split('/');
    if (path.startsWith('ref/e/')) {
      return ['/ref', + decodeURIComponent(parts[2])];
    }
    const route = parts[0];
    parts.splice(0, 1);
    return ['/' + route, parts.join('/')];
  }

  readonly query = computed(() => {
    if (this.nav()?.[0] === '/browse') return undefined;
    return parseBookmarkParams(this.url());
  });

  readonly localUrl = computed(() => {
    const url = this.url();
    if (url.toLowerCase().startsWith('tag:/'))return true
    if (url.startsWith(this.baseHref)) return true
    if (url.startsWith(getPath(this.baseHref)!)) return true;
    if (url.startsWith('/')) return true;
    return false;
  });

  readonly hasText = computed(() => this.meaningfulText(this.text()));

  private meaningfulText(text: string) {
    const url = this.url();
    if (!text || hasPrefix(text, 'user') || hasPrefix(text, 'plugin')) return false;
    if (url.startsWith('/tag/') || url.toLowerCase().startsWith('tag:/')) {
      if (text === '#' + url.substring(5)) return false;
    }
    const nav = this.localUrl() ? this.getNav() : undefined;
    if (nav?.[0] === '/tag' && text === '#' + nav[1]) return false;
    return text != url;
  }

  markRead(event: MouseEvent) {
    if (!this.admin.getPlugin('plugin/user/read')) return;
    if (event.button !== 0 && event.button !== 1) return;
    this.ts.createResponse('plugin/user/read', this.url()).subscribe();
  }

}
