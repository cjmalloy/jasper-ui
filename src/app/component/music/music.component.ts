import { Component, HostBinding, Input } from '@angular/core';
import { catchError, of } from 'rxjs';
import { Ext } from '../../model/ext';
import { ExtService } from '../../service/api/ext.service';
import { Store } from '../../store/store';
import { defaultOrigin } from '../../util/tag';

@Component({
  selector: 'app-music',
  templateUrl: './music.component.html',
  styleUrls: ['./music.component.scss']
})
export class MusicComponent {
  @HostBinding('class') css = 'music ext';


  ext?: Ext;
  error: any;

  constructor(
    private store: Store,
    private exts: ExtService,
  ) { }

  ngOnInit(): void {
  }

  ngOnDestroy() {
  }

  @Input()
  set tag(value: string) {
    if (this.ext?.tag === value) return;
    this.exts.get(defaultOrigin(value, this.store.account.origin)).pipe(
      catchError(err => {
        this.error = err;
        return of(undefined);
      }),
    ).subscribe(ext => this.ext = ext);
  }
}
