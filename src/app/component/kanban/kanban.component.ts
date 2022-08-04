import { Component, Input, OnInit } from '@angular/core';
import { catchError, of } from 'rxjs';
import { Ext } from '../../model/ext';
import { ExtService } from '../../service/api/ext.service';

@Component({
  selector: 'app-kanban',
  templateUrl: './kanban.component.html',
  styleUrls: ['./kanban.component.scss']
})
export class KanbanComponent implements OnInit {

  ext?: Ext;
  disableSwimLanes = false;
  error: any;

  constructor(
    private exts: ExtService,
  ) { }

  ngOnInit(): void {
  }

  @Input()
  set tag(value: string) {
    if (this.ext?.tag === value) return;
    this.exts.get(value).pipe(
      catchError(err => {
        this.error = err;
        return of(undefined);
      }),
    ).subscribe(ext => this.ext = ext);
  }

  get swimLanes() {
    if (this.disableSwimLanes) return undefined;
    if (!this.ext?.config.swimLanes) return undefined;
    if (!this.ext?.config.swimLanes.length) return undefined;
    return this.ext?.config.swimLanes;
  }

}
