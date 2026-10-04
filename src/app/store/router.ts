import { Injectable, signal, inject } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/**
 * Signal based store tracking the current route.
 */
@Injectable({
  providedIn: 'root'
})
export class RouterStore {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);


  readonly url = signal('');
  readonly routeSnapshot = signal<ActivatedRouteSnapshot | null>(null, { equal: () => false });

  constructor() {
    const router = this.router;

    router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        this.routeSnapshot.set(this.activatedRoute.snapshot);
        this.url.set(e.urlAfterRedirects);
      });
  }

}
