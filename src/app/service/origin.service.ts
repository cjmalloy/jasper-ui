import { Injectable } from '@angular/core';
import { Observable, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../model/ref';
import { Store } from '../store/store';
import { AdminService } from './admin.service';
import { RefService } from './api/ref.service';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class OriginService {

  origins: Ref[] = [];

  constructor(
    private config: ConfigService,
    private admin: AdminService,
    private refs: RefService,
    private store: Store,
  ) { }

  get init$() {
    this.origins = [];
    if (!this.admin.status.plugins.origin) return of();
    return this.loadOrigins$().pipe(
      tap(() => this.store.origins.setOrigins(this.origins, this.config.api, this.store.account.origin)),
    );
  }

  private loadOrigins$(page = 0): Observable<null> {
    const alreadyLoaded = page * this.config.fetchBatch;
    if (alreadyLoaded >= this.config.maxOrigins) {
      console.error(`Too many origins to load, only loaded ${alreadyLoaded}. Increase maxOrigins to load more.`)
      return of(null);
    }
    return this.refs.page({query: '+plugin/origin@*', page, size: this.config.fetchBatch}).pipe(
      tap(batch => this.origins.push(...batch.content)),
      switchMap(batch => batch.last ? of(null) : this.loadOrigins$(page + 1)),
    );
  }
}
