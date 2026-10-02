import { computed, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, linkedSignal, signal, afterNextRender } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, of, startWith, switchMap } from 'rxjs';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { VisibilityService } from '../../service/visibility.service';
import { getPath, parseBookmarkParams } from '../../util/http';
import { hasPrefix } from '../../util/tag';

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink]
})
export class NavComponent {
  private destroyRef = inject(DestroyRef);

  readonly url = input('');
  readonly titleInput = input('', { alias: 'title' });
  readonly title = computed(() => this.titleInput() || this.preview()?.tag || '');
  readonly textInput = input('', { alias: 'text' });
  readonly text = computed(() => this.preview()?.name || this.textInput() || this.preview()?.tag || '');
  readonly css = input('');
  readonly external = input(false);

  private readonly exists = toSignal(toObservable(computed(() =>
    this.url() && !this.localUrl() && !this.external() ? this.url() : undefined,
  )).pipe(switchMap(url => !url ? of(false) : new Observable<void>(subscriber => {
    this.vis.notifyVisible(this.el, () => subscriber.next());
  }).pipe(switchMap(() => this.refs.exists(url)), startWith(false)))), { initialValue: false });
  readonly nav = computed(() => this.localUrl() ? this.getNav() : this.exists() ? ['/ref', this.url()] : undefined);
  private readonly preview = toSignal(toObservable(computed(() => {
    const nav = this.localUrl() ? this.getNav() : undefined;
    return nav?.[0] === '/tag' && !this.external() && !this.meaningfulText(this.textInput())
      ? nav[1] as string : undefined;
  })).pipe(switchMap(tag => tag ? this.editor.getTagPreview(tag).pipe(startWith(undefined)) : of(undefined))),
  { initialValue: undefined });
  private readonly baseHref = document.getElementsByTagName('base')[0]?.href || document.baseURI || location.origin + '/';

  constructor(
    private config: ConfigService,
    private admin: AdminService,
    private refs: RefService,
    private ts: TaggingService,
    private editor: EditorService,
    private vis: VisibilityService,
    private el: ElementRef,
  ) { }


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
    return text != url;
  }

  markRead(event: MouseEvent) {
    if (!this.admin.getPlugin('plugin/user/read')) return;
    if (event.button !== 0 && event.button !== 1) return;
    this.ts.createResponse('plugin/user/read', this.url()).subscribe();
  }

}
