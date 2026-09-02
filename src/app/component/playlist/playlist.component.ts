import { Component, forwardRef, input, model, OnChanges, SimpleChanges } from '@angular/core';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { ViewerComponent } from '../viewer/viewer.component';
import { Page } from '../../model/page';
import { LoadingComponent } from '../loading/loading.component';
import { getTitle } from '../../util/format';
import { computed } from 'mobx';

@Component({
  selector: 'app-playlist',
  templateUrl: './playlist.component.html',
  styleUrls: ['./playlist.component.scss'],
  imports: [
    forwardRef(() => ViewerComponent),
    LoadingComponent,
  ],
})
export class PlaylistComponent implements OnChanges {

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

  constructor(
    private refs: RefService,
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref?.currentValue?.sources?.length) {
      this.index.set(0);
      this.refs.page({
        sources: this.ref()?.url,
        size: 2000,
      }).subscribe(page => this.sources.set(page));
    }
  }

  title(url?: string) {
    return getTitle(this.sources()?.content.find(s => s.url === url));
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
}
