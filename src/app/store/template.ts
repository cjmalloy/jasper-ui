import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { makeAutoObservable, observable, runInAction } from 'mobx';
import { catchError, Subscription, throwError } from 'rxjs';
import { Page } from '../model/page';
import { TagPageArgs } from '../model/tag';
import { Template } from '../model/template';
import { TemplateService } from '../service/api/template.service';

@Injectable({
  providedIn: 'root'
})
export class TemplateStore {

  args?: TagPageArgs = {} as any;
  page?: Page<Template> = {} as any;
  error?: HttpErrorResponse = {} as any;

  private running?: Subscription;

  constructor(
    private templates: TemplateService,
  ) {
    makeAutoObservable(this, {
      args: observable.struct,
      page: observable.ref,
    });
    this.clear(); // Initial observables may not be null for MobX
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
        runInAction(() => this.error = err);
        return throwError(() => err);
      }),
    ).subscribe(p => runInAction(() => this.page = p));
  }

}
