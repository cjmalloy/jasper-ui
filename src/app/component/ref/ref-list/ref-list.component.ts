import { Component, ElementRef, HostBinding, HostListener, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import * as moment from 'moment';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { score } from '../../../mods/vote';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { AutoSizeVirtualScrollStrategy } from '@angular/cdk-experimental/scrolling';
import { defer } from 'lodash-es';


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
  top = 0;

  newRefs: Ref[] = [];
  contentHeight = 3000;

  private _page?: Page<Ref>;
  private globalScroll = 0;
  private last = '';

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
  get ss() {
    // @ts-ignore
    return this.viewport._scrollStrategy as AutoSizeVirtualScrollStrategy;
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(event: Event) {
    if (this.last === 'viewport') {
      this.last = '';
      return;
    }
    this.last = 'global';
    defer(() => {
      // @ts-ignore
    this.contentHeight = Math.max(Math.max(61, this.ss._averager._averageItemSize) * this.page!.content.length, this.viewport.measureViewportSize( 'vertical'));
      this.globalScroll = Math.floor(window.scrollY);
      this.viewport.scrollToOffset(this.scroll);
      this.top = this.scroll;
      console.log('g', this.contentHeight , this.globalScroll, this.el.nativeElement.offsetTop);
    });
  }

  scrollViewport(event: Event) {
    if (this.last === 'global') {
      this.last = '';
      return;
    }
    this.last = 'viewport';
    defer(() => {
      // @ts-ignore
      this.contentHeight = Math.max(Math.max(61, this.ss._averager._averageItemSize) * this.page!.content.length, this.viewport.measureViewportSize( 'vertical'));
      const oldScroll = Math.floor(this.globalScroll - this.el.nativeElement.offsetTop);
      this.globalScroll = Math.floor(Math.max(0, this.globalScroll + this.viewport.measureScrollOffset() - oldScroll));
      if (oldScroll <= 0 || this.scroll <= 0) {
        this.viewport.scrollToOffset(this.scroll, 'instant');
      }
      window.scrollTo({top: this.globalScroll });
      this.top = this.scroll;
      console.log('v', this.contentHeight , this.globalScroll, this.el.nativeElement.offsetTop, this.viewport.measureScrollOffset());
    });
  }

  get scroll() {
    return Math.min(this.contentHeight - this.viewport.measureViewportSize( 'vertical'), Math.max(0, this.globalScroll - this.el.nativeElement.offsetTop));
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
