import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { isEqual } from 'lodash-es';
import { catchError, of } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { TemplateService } from '../../service/api/template.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { printError } from '../../util/http';
import { withStableDateSort } from '../../util/query';
import {
  fixIndexConfig,
  hasFixable,
  hasIndexes,
  IndexConfig,
  indexList,
  indexNeeds,
  IndexNeeds,
  missingIndexes
} from '../../util/index-helper';
import { LoadingComponent } from '../loading/loading.component';

@Component({
  selector: 'app-index-helper',
  templateUrl: './index-helper.component.html',
  styleUrls: ['./index-helper.component.scss'],
  host: { 'class': 'index-helper actions' },
  imports: [LoadingComponent],
})
export class IndexHelperComponent {
  private admin = inject(AdminService);
  private auth = inject(AuthzService);
  private store = inject(Store);
  private query = inject(QueryStore);
  private templates = inject(TemplateService);
  private router = inject(Router);
  config = inject(ConfigService);

  readonly fixing = signal(false);
  readonly serverError = signal<string[]>([]);

  readonly enabled = computed(() => !!this.admin.getTemplate('_index.helper'));
  /**
   * Indices used by the request {@link QueryStore} sends.
   */
  readonly needs = computed(() => {
    const args = this.query.args();
    return indexNeeds(args && withStableDateSort(args));
  }, { equal: isEqual });
  readonly show = computed(() => this.enabled() && hasIndexes(this.needs()));

  /**
   * `_config/index` only exists in the root origin. In other origins the helper can only ask for indices.
   */
  readonly root = computed(() => !this.store.account.origin());

  /**
   * Only load the index config once a query uses an index.
   */
  private readonly indexConfig = rxResource({
    params: () => this.show() && this.root() && hasFixable(this.needs()) ? '_config/index' : undefined,
    stream: ({ params }) => this.templates.get(params).pipe(catchError(() => of(null))),
  });
  readonly loading = computed(() => this.indexConfig.isLoading());
  readonly index = computed(() => this.indexConfig.hasValue() ? this.indexConfig.value() : undefined);

  /**
   * The server ignores a disabled `_config/index`, so adding indices to it would not help.
   */
  readonly disabled = computed(() => !!this.index()?.config?.disabled);

  /**
   * Writing templates needs the config role, which defaults to admin.
   */
  readonly isAdmin = computed(() => this.auth.hasRole('ROLE_ADMIN'));
  readonly canFix = computed(() => !!this.index() && !this.disabled() && this.isAdmin());

  /**
   * Missing indices. When the index config can't be read, any hot tags or hot plugins
   * the query uses might be missing. Index flags default to on, so they are skipped.
   */
  readonly missing = computed((): IndexNeeds => {
    const index = this.index();
    if (index) return missingIndexes(this.needs(), index.config as IndexConfig);
    return { ...this.needs(), flags: [] };
  }, { equal: isEqual });

  readonly anyMissing = computed(() => hasIndexes(this.missing()));
  readonly fixable = computed(() => hasFixable(this.missing()));

  /**
   * Indices the query uses, marked ✅️ indexed, ⚠️ missing, ❔ unknown, or ✖️ can't be indexed.
   */
  readonly tooltip = computed(() => {
    if (this.loading()) return '';
    const needs = this.needs();
    const missing = this.missing();
    const mark = (list: string[], value: string) => !list.includes(value) ? '✅️' : this.index() ? '⚠️' : '❔';
    return [
      ...needs.flags.map(f => mark(missing.flags, f) + ' ' + f),
      ...needs.hotTags.map(t => mark(missing.hotTags, t) + ' tags->' + t),
      ...needs.hotPlugins.map(p => mark(missing.hotPlugins, p) + ' plugins->' + p),
      ...needs.hotResponses.map(p => mark(missing.hotResponses, p) + ' metadata->plugins->' + p),
      ...needs.hotRemoteResponses.map(p => mark(missing.hotRemoteResponses, p) + ' metadata->remotePlugins->' + p),
      ...needs.unindexed.map(c => '✖️ ' + c + ' ' + $localize`(sort can't be indexed)`),
    ].join('\n');
  });

  fix() {
    const index = this.index();
    if (!index || this.fixing()) return;
    this.fixing.set(true);
    this.serverError.set([]);
    const config = (index.config || {}) as IndexConfig;
    this.templates.merge(index.tag + index.origin, index.modifiedString!, {
      config: fixIndexConfig(this.missing(), config),
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError.set(printError(err));
        return of(null);
      }),
    ).subscribe(() => {
      this.fixing.set(false);
      this.indexConfig.reload();
    });
  }

  request() {
    const list = indexList(this.missing());
    const url = location.href;
    this.router.navigate(['/submit/dm'], {
      queryParams: {
        to: this.config.support,
        title: $localize`Index request`,
        comment: $localize`Please add these DB indices to the _config/index template to speed up this query:` + '\n\n' + list + '\n\n' + url,
      },
    });
  }
}
