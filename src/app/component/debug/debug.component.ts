import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, concat, concatMap, generate, last, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { ExtStore } from '../../store/ext';
import { PluginStore } from '../../store/plugin';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { TemplateStore } from '../../store/template';
import { UserStore } from '../../store/user';
import { printError } from '../../util/http';

@Component({
  standalone: false,
  selector: 'app-debug',
  templateUrl: './debug.component.html',
  styleUrls: ['./debug.component.scss']
})
export class DebugComponent {
  @HostBinding('class') css = 'debug actions';

  generating = false;
  settingUser = false;
  sourcing = false;
  batchRunning = false;
  serverError: string[] = [];
  debug = this.admin.getPlugin('plugin/debug') || this.admin.getTemplate('debug');

  constructor(
    public admin: AdminService,
    private store: Store,
    public query: QueryStore,
    public ext: ExtStore,
    public user: UserStore,
    public plugin: PluginStore,
    public template: TemplateStore,
    private refs: RefService,
    private ts: TaggingService,
    private router: Router,
  ) { }

  ngOnInit(): void {
  }

  get empty() {
    return !this.query.page?.content?.length;
  }

  batch(fn: (e: any) => Observable<any>) {
    if (this.batchRunning) return;
    this.batchRunning = true;
    concat(...this.query.page!.content.map(e => fn(e).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError.push(...printError(err));
        return of(null);
      }),
    ))).pipe(last()).subscribe(() => {
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

  setUser(tag: string) {
    this.router.navigate([], { queryParamsHandling: 'merge', queryParams: { debug: 'USER', tag }})
      .then(() => location.reload());
  }

  gen(n: any = 100) {
    this.generating = false;
    this.repeat(i => {
      const url = 'comment:' + uuid();
      return this.refs.create({
        url,
        origin: this.store.account.origin,
        title: 'Generated: ' + i,
        comment: uuid(),
        tags: ['public', 'gen'],
      }).pipe(
        tap(() => {
          if (this.admin.def.plugins.voteUpPlugin) {
            this.ts.createResponse('plugin/vote/up', url).subscribe();
          }
        }),
      );
    }, n);
  }

  source(url: string) {
    this.sourcing = false;
    this.batch(ref => {
      if (!ref.sources?.includes(url)) {
        if (ref.sources) {
          return this.refs.patch(ref.url, ref.origin!, ref.modifiedString, [{
            op: 'add',
            path: '/sources/-',
            value: url,
          }]);
        } else {
          return this.refs.patch(ref.url, ref.origin!, ref.modifiedString, [{
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
