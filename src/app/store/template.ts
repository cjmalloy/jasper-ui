import { HttpErrorResponse } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
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

  private _args = signal<TagPageArgs | undefined>(undefined);
  private _page = signal<Page<Template> | undefined>(undefined);
  private _error = signal<HttpErrorResponse | undefined>(undefined);

  private running?: Subscription;

  // Backwards compatible getters/setters
  get args() { return this._args(); }
  set args(value: TagPageArgs | undefined) { this._args.set(value); }

  get page() { return this._page(); }
  set page(value: Page<Template> | undefined) { this._page.set(value); }

  get error() { return this._error(); }
  set error(value: HttpErrorResponse | undefined) { this._error.set(value); }

  // New signal-based API
  args$ = computed(() => this._args());
  page$ = computed(() => this._page());
  error$ = computed(() => this._error());

  constructor(
    private templates: TemplateService,
  ) {
    this.clear(); // Initial values may not be null for signals
  }

  clear() {
    this.args = undefined;
    this.page = undefined;
    this.error = undefined;
    this.running?.unsubscribe();
  }

  close() {
    if (this.running && !this.running.closed) this.clear();
  }

  setArgs(args: TagPageArgs) {
    if (!isEqual(omit(this.args, 'search'), omit(args, 'search'))) this.clear();
    this.args = args;
    this.refresh();
  }

  refresh() {
    if (!this.args) return;
    this.running?.unsubscribe();
    this.running = this.templates.page(this.args).pipe(
      catchError((err: HttpErrorResponse) => {
        this.error = err;
        return throwError(() => err);
      }),
    ).subscribe(p => this.page = p);
  }

}
