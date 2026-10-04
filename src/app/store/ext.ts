import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal, inject } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { catchError, EMPTY, Subscription } from 'rxjs';
import { Ext } from '../model/ext';
import { Page } from '../model/page';
import { TagPageArgs } from '../model/tag';
import { ExtService } from '../service/api/ext.service';

@Injectable({
  providedIn: 'root'
})
export class ExtStore {
  private exts = inject(ExtService);


  readonly args = signal<TagPageArgs | undefined>(undefined, { equal: isEqual });
  readonly page = signal<Page<Ext> | undefined>(undefined);
  readonly error = signal<HttpErrorResponse | undefined>(undefined);

  private running?: Subscription;

  clear() {
    this.args.set(undefined);
    this.page.set(undefined);
    this.error.set(undefined);
    this.running?.unsubscribe();
  }

  close() {
    if (this.running && !this.running.closed) this.clear();
  }

  setArgs(args: TagPageArgs) {
    if (!isEqual(omit(this.args(), 'search'), omit(args, 'search'))) this.clear();
    this.args.set(args);
    this.refresh();
  }

  refresh() {
    if (!this.args()) return;
    this.running?.unsubscribe();
    this.running = this.exts.page(this.args()).pipe(
      catchError((err: HttpErrorResponse) => {
        this.error.set(err);
        return EMPTY;
      }),
    ).subscribe(p => this.page.set(p));
  }

}
