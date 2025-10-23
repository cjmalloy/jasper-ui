import { Component, forwardRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { ViewerComponent } from '../viewer/viewer.component';

@Component({
  selector: 'app-playlist',
  templateUrl: './playlist.component.html',
  styleUrls: ['./playlist.component.scss'],
  imports: [
    forwardRef(() => ViewerComponent),
  ],
})
export class PlaylistComponent implements OnChanges {

  @Input()
  ref?: Ref;

  index = 0;
  page?: Ref;

  constructor(
    private refs: RefService,
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref?.currentValue?.sources?.length) {
      this.index = 0;
      this.fetch();
    }
  }

  fetch() {
    this.refs.getCurrent(this.ref!.sources![this.index]).subscribe(ref => this.page = ref);
  }

  back() {
    this.index = (this.index - 1 + this.ref!.sources!.length) % this.ref!.sources!.length;
    this.fetch();
  }

  next() {
    this.index = (this.index + 1) % this.ref!.sources!.length;
    this.fetch();
  }
}
