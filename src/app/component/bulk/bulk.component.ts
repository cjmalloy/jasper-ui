import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit } from '@angular/core';
import * as _ from 'lodash-es';
import * as moment from 'moment';
import { catchError, forkJoin, Observable, of } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { deleteNotice } from '../../plugin/delete';
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
import { Store } from '../../store/store';
import { TemplateStore } from '../../store/template';
import { UserStore } from '../../store/user';
import { Type } from '../../store/view';
import { downloadPage } from '../../util/download';
import { TAGS_REGEX } from '../../util/format';
import { printError } from '../../util/http';
import { hasTag } from '../../util/tag';

@Component({
  selector: 'app-bulk',
  templateUrl: './bulk.component.html',
  styleUrls: ['./bulk.component.scss']
})
export class BulkComponent implements OnInit {
  @HostBinding('class') css = 'bulk actions';
  tagRegex = TAGS_REGEX.source;

  @Input()
  type: Type = 'ref';

  batchRunning = false;
  tagging = false;
  deleting = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public store: Store,
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

  get urls() {
    if (!this.query.page?.content.length) return [];
    return _.uniq(this.query.page!.content.map(ref => ref.url));
  }

  batch(fn: (e: any) => Observable<any>) {
    if (this.batchRunning) return;
    this.batchRunning = true;
    forkJoin(this.queryStore.page!.content.map(e => fn(e).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError.push(...printError(err));
        return of(null);
      }),
    ))).subscribe(() => {
      this.queryStore.refresh();
      this.batchRunning = false;
    });
  }

  get queryStore() {
    switch (this.type) {
      case 'ref': return this.query;
      case 'ext': return this.ext
      case 'user': return this.user;
      case 'plugin': return this.plugin;
      case 'template': return this.template;
    }
  }

  get service() {
    switch (this.type) {
      case 'ref': return this.refs;
      case 'ext': return this.exts
      case 'user': return this.users
      case 'plugin': return this.plugins;
      case 'template': return this.templates;
    }
  }

  get empty() {
    return !this.queryStore.page?.content?.length;
  }

  get name() {
    let name = '';
    name = this.store.view.name || this.type;
    if (this.store.view.search) {
      name += ' search(' + this.store.view.search + ')';
    }
    if (this.store.view.filter.length) {
      name += ' filter(' + this.store.view.filter.join(',') + ')';
    }
    if (this.store.view.isSorted) {
      name += ' sort(' + this.store.view.sort.join(',') + ')';
    }
    return name;
  }

  download() {
    downloadPage(this.type, this.queryStore.page!, this.name);
  }

  tag(tag: string) {
    this.tagging = false;
    tag = tag.toLowerCase().trim();
    this.batch(ref => this.ts.create(tag, ref.url, ref.origin!));
  }

  approve() {
    this.batch(ref => {
      if (!hasTag('_moderated', ref)) {
        return this.refs.patch(ref.url, ref.origin!, [{
          op: 'add',
          path: '/tags/-',
          value: '_moderated',
        }]);
      } else {
        return of(null);
      }
    });
  }

  accept() {
    this.batch(ref => {
      if (ref.metadata?.plugins?.['plugin/invoice/disputed'].length) {
        return this.refs.delete(ref.metadata!.plugins['plugin/invoice/disputed'][0]);
      } else {
        return of(null);
      }
    });
  }

  dispute() {
    this.batch(ref => this.refs.create({
      url: 'internal:' + uuid(),
      published: moment(),
      tags: ['internal', this.store.account.localTag, 'plugin/invoice/disputed'],
      sources: [ref.url],
    }));
  }

  markPaid() {
    this.batch(ref => {
      if (ref.metadata?.plugins?.['plugin/invoice/rejected'].length) {
        return forkJoin(
          this.refs.delete(ref.metadata!.plugins['plugin/invoice/rejected'][0]),
          this.refs.create({
            url: 'internal:' + uuid(),
            published: moment(),
            tags: ['internal', this.store.account.localTag, 'plugin/invoice/paid'],
            sources: [ref.url],
          })
        );
      } else {
        return of(null);
      }
    });
  }

  reject() {
    this.batch(ref => {
      if (ref.metadata?.plugins?.['plugin/invoice/paid'].length) {
        return forkJoin(
          this.refs.delete(ref.metadata!.plugins['plugin/invoice/paid'][0]),
          this.refs.create({
            url: 'internal:' + uuid(),
            published: moment(),
            tags: ['internal', this.store.account.localTag, 'plugin/invoice/rejected'],
            sources: [ref.url],
          })
        );
      } else {
        return of(null);
      }
    });
  }

  scrape() {
    this.batch(ref => this.scraper.feed(ref.url, ref.origin!));
  }

  delete() {
    this.deleting = false;
    if (this.type === 'ref') {
      this.batch(ref => this.admin.status.plugins.delete
        ? this.refs.update(deleteNotice(ref))
        : this.refs.delete(ref.url, ref.origin)
      );
    } else {
      this.batch(tag => this.service.delete(tag.tag + tag.origin))
    }
  }

}
