import { Injectable, signal } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/**
 * Signal based store tracking the current route.
 */
@Injectable({
  providedIn: 'root'
})
export class RouterStore {

  private readonly _url = signal('');
  private readonly _routeSnapshot = signal<ActivatedRouteSnapshot | null>(null, { equal: () => false });

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) {
    router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        this.routeSnapshot = this.activatedRoute.snapshot;
        this.url = e.urlAfterRedirects;
      });
  }

  get url() {
    return this._url();
  }

  set url(value: string) {
    this._url.set(value);
  }

  get routeSnapshot() {
    return this._routeSnapshot();
  }

  set routeSnapshot(value: ActivatedRouteSnapshot | null) {
    this._routeSnapshot.set(value);
  }
}
