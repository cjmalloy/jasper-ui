import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal, inject } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { catchError, EMPTY, Subscription } from 'rxjs';
import { Page } from '../model/page';
import { TagPageArgs } from '../model/tag';
import { Template } from '../model/template';
import { TemplateService } from '../service/api/template.service';

@Injectable({
  providedIn: 'root'
})
export class TemplateStore {
  private templates = inject(TemplateService);


  readonly args = signal<TagPageArgs | undefined>(undefined, { equal: isEqual });
  readonly page = signal<Page<Template> | undefined>(undefined);
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
    this.running = this.templates.page(this.args()).pipe(
      catchError((err: HttpErrorResponse) => {
        this.error.set(err);
        return EMPTY;
      }),
    ).subscribe(p => this.page.set(p));
  }

}
