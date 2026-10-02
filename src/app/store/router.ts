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

  readonly url = signal('');
  readonly routeSnapshot = signal<ActivatedRouteSnapshot | null>(null, { equal: () => false });

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) {
    router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        this.routeSnapshot.set(this.activatedRoute.snapshot);
        this.url.set(e.urlAfterRedirects);
      });
  }

}
