import { computed, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, linkedSignal, signal, afterNextRender } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  readonly title = linkedSignal(() => this.titleInput());
  readonly textInput = input('', { alias: 'text' });
  readonly text = linkedSignal(() => this.textInput());
  readonly css = input('');
  readonly external = input(false);

  readonly nav = signal<(string|number)[] | undefined>(undefined);

  constructor(
    private config: ConfigService,
    private admin: AdminService,
    private refs: RefService,
    private ts: TaggingService,
    private editor: EditorService,
    private vis: VisibilityService,
    private el: ElementRef,
  ) { }

  private readonly initialize = afterNextRender(() => {
    if (this.localUrl()) {
      this.nav.set(this.getNav());
      if (this.nav()![0] === '/tag' && !this.external() && !this.hasText()) {
        this.editor.getTagPreview(this.nav()![1] as string)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(x => {
            this.text.set(x?.name || this.text() || x?.tag || '');
            this.title.set(this.title() || x?.tag || '');
          });
      }
    } else if (!this.external()) {
      this.vis.notifyVisible(this.el, () => {
        this.refs.exists(this.url()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(exists => {
          if (exists) {
            this.nav.set(['/ref', this.url()]);
          }
        });
      });
    }
  });


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

  private get baseHref() {
    return document.getElementsByTagName('base')[0]?.href || document.baseURI || location.origin + '/';
  }

  readonly hasText = computed(() => {
    const text = this.text();
    const url = this.url();
    if (!text || hasPrefix(text, 'user') || hasPrefix(text, 'plugin')) return false;
    if (url.startsWith('/tag/') || url.toLowerCase().startsWith('tag:/')) {
      if (text === '#' + url.substring(5)) return false;
    }
    return text != url;
  });

  markRead(event: MouseEvent) {
    if (!this.admin.getPlugin('plugin/user/read')) return;
    if (event.button !== 0 && event.button !== 1) return;
    this.ts.createResponse('plugin/user/read', this.url()).subscribe();
  }

}
