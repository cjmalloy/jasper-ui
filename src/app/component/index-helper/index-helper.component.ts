import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { isEqual } from 'lodash-es';
import { catchError, of } from 'rxjs';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
import { AdminService } from '../../service/admin.service';
import { TemplateService } from '../../service/api/template.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { printError } from '../../util/http';
import {
  fixIndexConfig,
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
  imports: [FakeLinkDirective, LoadingComponent],
})
export class IndexHelperComponent {
  private admin = inject(AdminService);
  private store = inject(Store);
  private auth = inject(AuthzService);
  private query = inject(QueryStore);
  private templates = inject(TemplateService);
  private router = inject(Router);
  config = inject(ConfigService);

  readonly fixing = signal(false);
  readonly serverError = signal<string[]>([]);

  readonly enabled = computed(() => !!this.admin.getTemplate('_index.helper'));
  readonly needs = computed(() => indexNeeds(this.query.args()), { equal: isEqual });

  /**
   * Only load the index config once a query uses an index.
   */
  private readonly indexConfig = rxResource({
    params: () => this.enabled() && hasIndexes(this.needs()) ? '_config/index' + this.store.account.origin() : undefined,
    stream: ({ params }) => this.templates.get(params).pipe(catchError(() => of(null))),
  });
  readonly index = computed(() => this.indexConfig.hasValue() ? this.indexConfig.value() : undefined);

  /**
   * Writing templates needs the config role, which defaults to admin.
   */
  readonly canFix = computed(() => !!this.index() && this.auth.hasRole('ROLE_ADMIN'));

  /**
   * Missing indices. When the index config can't be read, any hot tags or hot plugins
   * the query uses might be missing. Index flags default to on, so they are skipped.
   */
  readonly missing = computed((): IndexNeeds => {
    const index = this.index();
    if (index) return missingIndexes(this.needs(), index.config as IndexConfig);
    return { ...this.needs(), flags: [] };
  }, { equal: isEqual });

  readonly show = computed(() => {
    if (!this.enabled()) return false;
    if (this.indexConfig.isLoading()) return false;
    if (!this.canFix() && !this.config.support) return false;
    return hasIndexes(this.missing());
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
