import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, isDevMode } from '@angular/core';
import { catchError, concatMap, forkJoin, generate, Observable, of } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { ExtStore } from '../../store/ext';
import { PluginStore } from '../../store/plugin';
import { QueryStore } from '../../store/query';
import { TemplateStore } from '../../store/template';
import { UserStore } from '../../store/user';
import { printError } from '../../util/http';

@Component({
  selector: 'app-debug',
  templateUrl: './debug.component.html',
  styleUrls: ['./debug.component.scss']
})
export class DebugComponent {
  @HostBinding('class') css = 'debug actions';

  generating = false;
  sourcing = false;
  batchRunning = false;
  serverError: string[] = [];
  debug = isDevMode();

  constructor(
    public admin: AdminService,
    public query: QueryStore,
    public ext: ExtStore,
    public user: UserStore,
    public plugin: PluginStore,
    public template: TemplateStore,
    private refs: RefService,
  ) { }

  ngOnInit(): void {
  }

  get empty() {
    return !this.query.page?.content?.length;
  }

  batch(fn: (e: any) => Observable<any>) {
    if (this.batchRunning) return;
    this.batchRunning = true;
    forkJoin(this.query.page!.content.map(e => fn(e).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError.push(...printError(err));
        return of(null);
      }),
    ))).subscribe(() => {
      this.query.refresh();
      this.batchRunning = false;
    });
  }

  repeat(fn: (i: number) => Observable<any>, n = 100) {
    if (this.batchRunning) return;
    this.batchRunning = true;
    generate(0, x => x < n, x => x + 1).pipe(
      concatMap(i => fn(i)),
      catchError((err: HttpErrorResponse) => {
        this.serverError.push(...printError(err));
        return of(null);
      }),
    ).subscribe(() => {
      this.batchRunning = false;
    });
  }

  gen(n: any = 100) {
    this.generating = false;
    this.repeat(i => this.refs.create({
      url: 'comment:' + uuid(),
      title: 'Generated: ' + i,
      comment: uuid(),
      tags: ['public', 'gen']
    }), n);
  }

  source(url: string) {
    this.sourcing = false;
    this.batch(ref => {
      if (!ref.sources?.includes(url)) {
        if (ref.sources) {
          return this.refs.patch(ref.url, ref.origin!, [{
            op: 'add',
            path: '/sources/-',
            value: url,
          }]);
        } else {
          return this.refs.patch(ref.url, ref.origin!, [{
            op: 'add',
            path: '/sources',
            value: [url],
          }]);
        }
      } else {
        return of(null);
      }
    });
  }

}
