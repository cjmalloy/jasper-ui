import { Component, forwardRef, input, model, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { catchError, Observable, of, Subscription, switchMap, throwError } from 'rxjs';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { ViewerComponent } from '../viewer/viewer.component';
import { Page } from '../../model/page';
import { LoadingComponent } from '../loading/loading.component';
import { getTitle } from '../../util/format';
import { computed } from 'mobx';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer } from 'lodash-es';
import { Store } from '../../store/store';
import { hasTag } from '../../util/tag';
import { ProxyService } from '../../service/api/proxy.service';
import { memo } from '../../util/memo';
import { getExtension } from '../../util/http';
import { AdminService } from '../../service/admin.service';
import { downloadPlaylist } from '../../util/download';

@Component({
  selector: 'app-playlist',
  templateUrl: './playlist.component.html',
  styleUrls: ['./playlist.component.scss'],
  imports: [
    forwardRef(() => ViewerComponent),
    LoadingComponent,
  ],
})
export class PlaylistComponent implements OnChanges, OnDestroy {

  ref = input<Ref | undefined>(undefined);
  index = model(0);
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
  sources = model<Page<Ref> | undefined>(undefined);
  private loading?: Subscription;

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

  ngOnChanges(changes: SimpleChanges) {
    if (!changes.ref) return;
    this.loading?.unsubscribe();
    this.sources.set(undefined);
    const ref = changes.ref.currentValue as Ref | undefined;
    if (!ref?.sources?.length) return;
    this.index.set(0);
    this.loading = this.loadSources(ref.url, ref.sources.length)
      .subscribe(page => this.sources.set(page));
  }

  ngOnDestroy() {
    this.loading?.unsubscribe();
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
