import { HttpErrorResponse } from '@angular/common/http';
import { effect, Injectable, signal } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { catchError, Subscription, throwError } from 'rxjs';
import { Page } from '../model/page';
import { TagPageArgs } from '../model/tag';
import { Template } from '../model/template';
import { TemplateService } from '../service/api/template.service';

@Injectable({
  providedIn: 'root'
})
export class TemplateStore {

  private _args = signal<TagPageArgs | undefined>(undefined, { equal: isEqual });
  private _page = signal<Page<Template> | undefined>(undefined);
  private _error = signal<HttpErrorResponse | undefined>(undefined);
  private _refresh = signal(0);

  private running?: Subscription;

  constructor(
    private templates: TemplateService,
  ) {
    effect(() => {
      const args = this._args();
      this._refresh(); // Track refresh signal
      if (!args) return;
      this.running?.unsubscribe();
      this.running = this.templates.page(args).pipe(
        catchError((err: HttpErrorResponse) => {
          this._error.set(err);
          return throwError(() => err);
        }),
      ).subscribe(p => this._page.set(p));
    });
  }

  get args() { return this._args(); }
  set args(value: TagPageArgs | undefined) { this._args.set(value); }

  get page() { return this._page(); }
  set page(value: Page<Template> | undefined) { this._page.set(value); }

  get error() { return this._error(); }
  set error(value: HttpErrorResponse | undefined) { this._error.set(value); }

  clear() {
    this._args.set(undefined);
    this._page.set(undefined);
    this._error.set(undefined);
    this.running?.unsubscribe();
  }

  close() {
    if (this.running && !this.running.closed) this.clear();
  }

  setArgs(args: TagPageArgs) {
    if (!isEqual(omit(this._args(), 'search'), omit(args, 'search'))) this.clear();
    this._args.set(args);
  }

  refresh() {
    this._refresh.update(n => n + 1);
  }
}
