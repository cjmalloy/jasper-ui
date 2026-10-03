import { ChangeDetectionStrategy, computed, Component, effect, forwardRef, input, linkedSignal, model, output } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, Observable, of, startWith, switchMap, throwError } from 'rxjs';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { ProxyService } from '../../service/api/proxy.service';
import { RefService } from '../../service/api/ref.service';
import { Store } from '../../store/store';
import { downloadPlaylist } from '../../util/download';
import { getTitle } from '../../util/format';
import { getExtension } from '../../util/http';
import { hasTag } from '../../util/tag';
import { LoadingComponent } from '../loading/loading.component';
import { ViewerComponent } from '../viewer/viewer.component';

@Component({
  selector: 'app-playlist',
  templateUrl: './playlist.component.html',
  styleUrls: ['./playlist.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'playlist' },
  imports: [
    forwardRef(() => ViewerComponent),
    LoadingComponent,
  ],
})
export class PlaylistComponent {

  ref = input<Ref | undefined>(undefined);
  readonly indexInput = input(0, { alias: 'index' });
  readonly index = linkedSignal(() => { this.ref(); return this.indexInput(); });
  readonly indexChange = output<number>();
  repeat = model(true);
  autoplay = model(false);

  current = computed<Ref>(() => {
    const sources = this.sources();
    const index = this.index();
    const ref = this.ref();
    if (!sources || !ref) return { } as Ref;
    const url = ref.sources![index];
    return sources.content.find(ref => ref.url === url) || { url }
  });
  private readonly loadedSources = toSignal(toObservable(computed(() => {
    const ref = this.ref();
    return ref?.sources?.length ? { url: ref.url, length: ref.sources.length } : undefined;
  })).pipe(switchMap(ref => ref ? this.loadSources(ref.url, ref.length).pipe(
    catchError(() => of(undefined)),
    startWith(undefined),
  ) : of(undefined))), { initialValue: undefined });
  readonly sourcesInput = input<Page<Ref> | undefined>(undefined, { alias: 'sources' });
  readonly sources = linkedSignal(() => this.sourcesInput() || this.loadedSources());
  readonly sourcesChange = output<Page<Ref> | undefined>();

  constructor(
    private admin: AdminService,
    private refs: RefService,
    private proxy: ProxyService,
    private store: Store,
  ) {
    this.store.eventBus.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event.event === 'media' && this.ref() && this.store.eventBus.isRef(event, this.ref()!) && this.sources()?.content.length) {
        const mediaList = [];
        for (const s of this.sources()!.content) {
          const file = this.getTag('plugin/file', s);
          const audio = this.getTag('plugin/audio', s);
          const video = this.getTag('plugin/video', s);
          const image = this.getTag('plugin/image', s);
          if (file) {
            mediaList.push(this.proxy.getFetch(s.url, s.origin, this.getFilename(s)));
          } else if (audio && (audio.startsWith('cache:') || this.admin.getPlugin('plugin/audio')?.config?.proxy)) {
            mediaList.push(this.proxy.getFetch(audio, s.origin, this.getFilename(s, $localize`Untitled Audio`)));
          } else if (video && (video.startsWith('cache:') || this.admin.getPlugin('plugin/video')?.config?.proxy)) {
            mediaList.push(this.proxy.getFetch(video, s.origin, this.getFilename(s, $localize`Untitled Video`)));
          } else if (image && (image.startsWith('cache:') || this.admin.getPlugin('plugin/image')?.config?.proxy)) {
            mediaList.push(this.proxy.getFetch(image, s.origin, this.getFilename(s, $localize`Untitled Image`)));
          }
        }
        downloadPlaylist(this.proxy, mediaList, this.ref()!.title || 'playlist');
      }
    });
    effect(() => {
      this.indexChange.emit(this.index());
    });
    effect(() => {
      this.sourcesChange.emit(this.sources());
    });
  }

  getTag(tag: string, ref: Ref) {
    return this.admin.getPlugin(tag) &&
      hasTag(tag, ref) &&
      (ref?.plugins?.[tag]?.url || ref.url);
  }

  getFilename(ref: Ref, d = $localize`Untitled`) {
    const ext = getExtension(ref.url) || '';
    const filename = ref.title || d;
    return filename + (ext && !filename.toLowerCase().endsWith(ext) ? ext : '');
  }

  title(url?: string) {
    return getTitle(this.sources()?.content.find(s => s.url === url) || (url ? { url } : undefined));
  }

  seek(index: number) {
    this.index.set(index);
  }

  back() {
    this.index.set((this.index() - 1 + this.ref()!.sources!.length) % this.ref()!.sources!.length);
  }

  next(loop = true) {
    if (!loop && this.index() + 1 >= this.ref()!.sources!.length) return;
    this.index.set((this.index() + 1) % this.ref()!.sources!.length);
  }

  private loadSources(
    url: string,
    fallbackTotalPages: number,
    size = 20,
    page = 0,
    content: Ref[] = [],
    totalPages?: number,
  ): Observable<Page<Ref>> {
    if (page >= (totalPages ?? fallbackTotalPages)) return of(Page.of(content));
    return this.refs.page({
      sources: url,
      page,
      size,
      sort: ['modified', 'origin'],
    }).pipe(
      switchMap(batch => {
        const next = [...content, ...batch.content];
        if (page + 1 >= batch.page.totalPages) return of(Page.of(next));
        return this.loadSources(url, fallbackTotalPages, size, page + 1, next, batch.page.totalPages);
      }),
      catchError(err => {
        if (err.status !== 413) return throwError(() => err);
        return size > 1
          ? this.loadSources(url, fallbackTotalPages, Math.max(1, Math.floor(size / 2)))
          : this.loadSources(url, fallbackTotalPages, size, page + 1, content, totalPages)
      }),
    );
  }
}
