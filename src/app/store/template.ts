import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { autorun, makeAutoObservable, observable, runInAction } from 'mobx';
import { catchError, throwError } from 'rxjs';
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

  constructor(
    private templates: TemplateService,
  ) {
    makeAutoObservable(this, {
      args: observable.struct,
      page: observable.ref,
    });
    this.clear(); // Initial observables may not be null for MobX
    autorun(() => {
      runInAction(() => {
        this.page = undefined;
        this.error = undefined;
      });
      if (this.args) {
        this.refresh();
      }
    });
  }

  clear() {
    this.args = undefined;
    this.page = undefined;
    this.error = undefined;
  }

  setArgs(args: TagPageArgs) {
    this.args = args;
  }

  refresh() {
    if (!this.args) return;
    this.templates.page(this.args).pipe(
      catchError((err: HttpErrorResponse) => {
        runInAction(() => this.error = err);
        return throwError(() => err);
      }),
    ).subscribe(p => runInAction(() => this.page = p));
  }

}
