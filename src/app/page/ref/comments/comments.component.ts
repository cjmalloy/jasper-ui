import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { autorun, IReactionDisposer } from 'mobx';
import { filter, map, startWith, Subject, switchMap } from 'rxjs';
import { Ref } from '../../../model/ref';
import { mailboxes } from '../../../plugin/mailbox';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-ref-comments',
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.scss'],
})
export class RefCommentsComponent implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];
  newComments$ = new Subject<Ref | null>();

  constructor(
    private theme: ThemeService,
    private router: Router,
    private route: ActivatedRoute,
    public store: Store,
  ) {
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.theme.setTitle('Comments: ' + (this.store.view.ref?.title || this.store.view.url));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.newComments$.complete();
  }

  get url$() {
    return this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(this.router),
      switchMap(() => this.route.params),
      map(params => params['ref']),
    );
  }

  get depth() {
    return this.store.view.depth || 7;
  }

  mailboxes(ref: Ref) {
    return mailboxes(ref, this.store.account.tag);
  }
}
