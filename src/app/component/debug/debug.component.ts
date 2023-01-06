import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, isDevMode } from '@angular/core';
import { catchError, concatMap, forkJoin, generate, map, mergeMap, Observable, of } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { PluginService } from '../../service/api/plugin.service';
import { RefService } from '../../service/api/ref.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { TaggingService } from '../../service/api/tagging.service';
import { TemplateService } from '../../service/api/template.service';
import { UserService } from '../../service/api/user.service';
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
    private exts: ExtService,
    private users: UserService,
    private plugins: PluginService,
    private templates: TemplateService,
    private ts: TaggingService,
    private scraper: ScrapeService,
  ) { }

  ngOnInit(): void {
  }


  batch(fn: (i: number) => Observable<any>, n = 100) {
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
    this.batch(i => this.refs.create({
      url: 'comment:' + uuid(),
      title: 'Generated: ' + i,
      comment: uuid(),
      tags: ['public', 'gen']
    }), n);
  }


}
