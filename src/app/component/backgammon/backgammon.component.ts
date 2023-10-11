import { CdkDragDrop, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, ElementRef, EventEmitter, HostBinding, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Square } from 'chess.js';
import { delay, range, uniq } from 'lodash-es';
import { toJS } from 'mobx';
import * as moment from 'moment/moment';
import { catchError, Subject, Subscription, takeUntil, throwError } from 'rxjs';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { StompService } from '../../service/api/stomp.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

export type Piece = 'r' | 'b';
export type Spot = { index: number, col: number, red: boolean, top: boolean, pieces: Piece[]};

@Component({
  selector: 'app-backgammon',
  templateUrl: './backgammon.component.html',
  styleUrls: ['./backgammon.component.scss'],
  hostDirectives: [CdkDropListGroup]
})
export class BackgammonComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'backgammon-board';
  private destroy$ = new Subject<void>();

  @Input()
  red = true;
  @Output()
  comment = new EventEmitter<string>();
  @Output()
  copied = new EventEmitter<string>();

  moves: string[] = [];
  turn = 'r';
  off: Piece[] = [];
  spots: Spot[] = [];

  bounce = -1;
  dragSource = -1;
  created = true;
  writeAccess = false;

  private _ref?: Ref;
  private resizeObserver = new ResizeObserver(() => this.onResize());
  private watches: Subscription[] = [];
  /**
   * Flag to prevent animations for own moves.
   */
  private patchingComment = '';
  /**
   * Queued animation.
   */
  private incoming = -1;
  private board?: string;

  constructor(
    public config: ConfigService,
    private store: Store,
    private auth: AuthzService,
    private refs: RefService,
    private stomps: StompService,
    private el: ElementRef<HTMLDivElement>,
  ) {  }

  ngOnInit(): void {
    if (!this.watches.length && this.ref && this.config.websockets) {
      this.refs.page({ url: this.ref.url, obsolete: true, size: 500, sort: ['modified,DESC']}).subscribe(page => {
        this.stomps.watchRef(this.ref!.url, uniq(page.content.map(r => r.origin))).forEach(w => this.watches.push(w.pipe(
          takeUntil(this.destroy$),
        ).subscribe(u => {
          const moves = (u.comment?.substring(this.patchingComment.length || this.ref?.comment?.length || 0) || '')
          .trim()
          .split('\n')
          .map(m => m.trim() as Square)
          .filter(m => !!m);
          if (!moves.length) return;
          // TODO: queue all moves and animate one by one
          const move = moves.shift()!;
          this.ref!.title = u.title;
          this.ref!.comment = u.comment;
          this.ref = this.ref;
          this.store.eventBus.refresh(this.ref);
          this.ref!.modifiedString = u.modifiedString;
          const lastMove = this.incoming = parseInt(move.split(/\D+/g).pop()!) - 1;
          requestAnimationFrame(() => {
            if (lastMove != this.incoming) return;
            this.bounce = this.incoming;
            delay(() => this.bounce = -1, 3400);
          });
        })));
      });
    }
    this.resizeObserver.observe(this.el.nativeElement);
    if (this.local) {
      this.writeAccess = !this.ref?.created || this.ref?.upload || this.auth.writeAccess(this.ref);
    } else {
      this.writeAccess = true;
      this.refs.get(this.ref!.url, this.store.account.origin).pipe(
        catchError(err => {
          if (err.status === 404) {
            this.created = false;
          }
          return throwError(() => err);
        })
      ).subscribe(ref => {
        this.created = true;
        this.writeAccess = this.auth.writeAccess(ref)
      });
    }
    this.onResize();
    this.reset(this.ref?.comment);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get ref() {
    return this._ref;
  }

  @Input()
  set ref(value: Ref | undefined) {
    this.moves.length = 0;
    const newRef = this.ref && this.ref.url !== value?.url;
    this._ref = toJS(value);
    if (newRef) {
      this.watches.forEach(w => w.unsubscribe());
      this.watches = [];
      this.ngOnInit();
    } else {
      // TODO: Animate
      this.reset(value?.comment);
    }
  }

  get local() {
    return !this.ref?.created || this.ref.upload || this.ref?.origin === this.store.account.origin;
  }

  @HostListener('window:resize')
  onResize() {
    const dim = Math.floor(Math.min(this.el.nativeElement.offsetWidth, this.el.nativeElement.offsetHeight) / 26);
    const fontSize = Math.floor(1.5 * dim);
    this.el.nativeElement.style.setProperty('--dim', dim + 'px')
    this.el.nativeElement.style.setProperty('--piece-size', fontSize + 'px')
  }

  trackByColor(index: number, value: string) {
    return value;
  }

  trackByIdx(index: number, value: Spot) {
    return value.index;
  }

  onDragStarted(index: number) {
    this.dragSource = index;
    const dim = Math.floor(this.el.nativeElement.offsetWidth / 24);
    const fontSize = Math.floor(1.5 * dim);
    document.body.style.setProperty('--drag-piece-size', fontSize + 'px');
  }

  reset(board?: string) {
    this.moves = [];
    this.off = [];
    this.spots = range(24).map(index => (<Spot>{ index, col: index < 12 ? index + 1 : 24 - index, red: !(index % 2), top: index < 12, pieces: [] as string[] }));
    this.spots[ 0].pieces = [...'rr'] as Piece[];
    this.spots[ 5].pieces = [...'bbbbb'] as Piece[];
    this.spots[ 7].pieces = [...'bbb'] as Piece[];
    this.spots[11].pieces = [...'rrrrr'] as Piece[];
    this.spots[12].pieces = [...'bbbbb'] as Piece[];
    this.spots[16].pieces = [...'rrr'] as Piece[];
    this.spots[18].pieces = [...'rrrrr'] as Piece[];
    this.spots[23].pieces = [...'bb'] as Piece[];
    if (board) {
      for (const m of board.split('\n').map(m => m.trim())) {
        const parts = m.split(/[\sxX]+/g);
        const piece = parts[0] as Piece;
        const from = parts.length > 2 ? parseInt(parts[1]) : 0;
        const to = parseInt(parts[parts.length > 2 ? 2 : 1]);
        this.move(piece, from - 1, to - 1);
      }
    }
  }

  drawPiece(p: string) {
    return p === 'r' ? '🔴️' : '⚫️';
  }

  drop(event: CdkDragDrop<number, number, Piece>) {
    this.move(event.item.data, event.previousContainer.data, event.container.data);
    this.save();
  }

  move(piece: Piece, from: number, to: number) {
    if (from === to) return;
    if (from !== -1) {
      if (piece === 'r' != from < to) return;
      if (Math.abs(from - to) > 6) return;
    } else {
      if (Math.abs((piece === 'r' ? -1 : 23) - to) > 6) return;
    }
    const previous = from < 0 ? this.off : this.spots[from].pieces;
    const current = this.spots[to].pieces;
    if (!current.length || current[0] === piece) {
      previous.splice(previous.findIndex(p => p === piece), 1);
      current.push(piece);
      if (from < 0) {
        this.moves.push(piece + ' ' + (to + 1));
      } else {
        this.moves.push(piece + ' ' + (from + 1) + ' ' + (to + 1));
      }
    } else if (current.length === 1) {
      previous.splice(previous.findIndex(p => p === piece), 1);
      this.off.push(current[0]);
      current[0] = piece;
      this.moves.push(piece + ' ' + (from + 1) + 'x' + (to + 1));
    }
  }

  save() {
    const comment = this.patchingComment = this.moves.join('  \n');
    this.comment.emit(comment)
    if (!this.ref) return;
    (this.created ? this.refs.merge(this.ref.url, this.store.account.origin, this.ref!.modifiedString!,
      { comment }
    ) : this.refs.create({
      ...this.ref,
      origin: this.store.account.origin,
      comment,
    })).subscribe(modifiedString => {
      if (this.patchingComment !== comment) return;
      this.ref!.comment = comment;
      this.ref!.modified = moment(modifiedString);
      this.ref!.modifiedString = modifiedString;
      this.patchingComment = '';
      if (!this.local) {
        this.ref!.origin = this.store.account.origin;
        this.copied.emit(this.store.account.origin)
      }
      this.store.eventBus.refresh(this.ref);
    });
  }
}
