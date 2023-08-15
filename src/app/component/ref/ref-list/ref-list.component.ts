import { Component, ElementRef, HostBinding, HostListener, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import * as moment from 'moment';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { score } from '../../../mods/vote';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';


@Component({
  selector: 'app-ref-list',
  templateUrl: './ref-list.component.html',
  styleUrls: ['./ref-list.component.scss'],
})
export class RefListComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'ref-list';
  private destroy$ = new Subject<void>();

  @Input()
  pinned?: Ref[] | null;
  @Input()
  expanded = false;
  @Input()
  tag?: string | null;
  @Input()
  graph = false;
  @Input()
  showAlarm = true;
  @Input()
  pageControls = true;
  @Input()
  emptyMessage = 'No results found';
  @Input()
  showVotes = false;
  @Input()
  hideNewZeroVoteScores = true;
  @Input()
  newRefs$?: Observable<Ref | null>;

  @ViewChild(CdkVirtualScrollViewport)
  viewport!: CdkVirtualScrollViewport;
  transformScroll = 'translateY(0)';
  removedScroll = 'translateY(0)';

  newRefs: Ref[] = [];
  itemSize = 63;
  contentHeight = window.innerHeight;
  maxScroll = 0;

  private _page?: Page<Ref>;
  private globalScroll = 0;

  constructor(
      private router: Router,
      private el: ElementRef,
  ) { }

  get page(): Page<Ref> | undefined {
    return this._page;
  }

  @Input()
  set page(value: Page<Ref> | undefined) {
    this._page = value;
    if (this._page) {
      if (this._page.number > 0 && this._page.number >= this._page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: this._page.totalPages - 1
          },
          queryParamsHandling: 'merge',
        });
      }
      this.contentHeight = this.itemSize * this.page!.content.length;
    }
  }

  ngOnInit(): void {
    this.newRefs$?.pipe(
      takeUntil(this.destroy$),
    ).subscribe(ref => ref && this.newRefs.push(ref));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
  @HostListener('window:scroll', ['$event'])
  onScroll(event: Event) {
    // @ts-ignore
    this.maxScroll = this.contentHeight - this.viewport.measureViewportSize( 'vertical');
    this.globalScroll = window.scrollY;
    this.viewport.scrollTo({ top: this.scroll, behavior: 'instant' });
    this.transformScroll = `translateY(${this.scroll}px)`;
    this.removedScroll = `translateY(${this.itemSize * this.viewport.getRenderedRange().start}px)`;
  }

  get scroll() {
    return Math.min(this.maxScroll, Math.max(0, this.globalScroll - this.el.nativeElement.offsetTop));
  }

  getNumber(i: number) {
    if (this.showVotes) {
      const votes = score(this.page!.content[i]);
      if (votes < 100 &&
        this.hideNewZeroVoteScores &&
        moment().diff(this.page!.content[i].created!, 'minutes') < 5) {
        return '•';
      }
      return votes;
    }
    return i + this.page!.number * this.page!.size + 1;
  }
}
