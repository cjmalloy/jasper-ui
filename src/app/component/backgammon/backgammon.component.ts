import { CdkDragDrop, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, ElementRef, EventEmitter, HostBinding, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Square } from 'chess.js';
import { delay, filter, range, uniq, without } from 'lodash-es';
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
export type Spot = { index: number, col: number, red: boolean, move?: boolean, top: boolean, pieces: Piece[]};

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
  turn?: Piece;
  off: Piece[] = [];
  spots: Spot[] = [];

  bounce = -1;
  rolling?: Piece;
  dragSource = -1;
  created = true;
  writeAccess = false;
  redDice: number[] = [];
  blackDice: number[] = [];
  diceUsed: number[] = [];

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
  /**
   * Queued animation.
   */
  private incomingRolling?: Piece;
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
          if (move.includes('-')) {
            const lastRoll = this.incomingRolling = move.split(' ')[0] as Piece;
            requestAnimationFrame(() => {
              if (lastRoll != this.incomingRolling) return;
              this.rolling = this.incomingRolling;
              delay(() => this.rolling = undefined, 3400);
            });
          } else {
            const lastMove = this.incoming = parseInt(move.split(/\D+/g).pop()!) - 1;
            requestAnimationFrame(() => {
              if (lastMove != this.incoming) return;
              this.bounce = this.incoming;
              delay(() => this.bounce = -1, 3400);
            });
          }
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

  get doubles() {
    const ds = this.turn === 'r' ? this.redDice : this.blackDice;
    return ds[0] === ds[1];
  }

  get allUsed() {
    if (this.doubles && this.diceUsed.length === 4) return true;
    return this.diceUsed.length >= 2;
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
    if (index < 0) {
      this.setMovesOff(this.turn!);
    } else {
      this.setMoves(index);
    }
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
        const p = parts[0] as Piece;
        if (m.includes('-')) {
          const ds = p === 'r' ? this.redDice : this.blackDice;
          ds[0] = parseInt(m[2]);
          ds[1] = parseInt(m[4]);
          this.moves.push(`${p} ${ds[0]}-${ds[1]}`);
          this.turn = p;
          this.diceUsed = [];
          if (!this.turn && this.redDice[0] && this.blackDice[0]) {
            this.turn = this.redDice[0] > this.blackDice[0] ? 'r' : 'b';
          }
        } else {
          const from = parts.length > 2 ? parseInt(parts[1]) : 0;
          const to = parseInt(parts[parts.length > 2 ? 2 : 1]);
          this.move(p, from - 1, to - 1);
        }
      }
    }
  }

  drawPiece(p: string) {
    return p === 'r' ? '🔴️' : '⚫️';
  }

  drop(event: CdkDragDrop<number, number, Piece>) {
    this.move(event.item.data, event.previousContainer.data, event.container.data);
    this.save();
    this.clearMoves();
  }

  move(p: Piece, from: number, to: number) {
    if (from === to) return;
    if (!this.getMoves(p, from, this.dice).includes(to)) throw $localize`Illegal Move`;
    this.diceUsed.push(...this.getDiceUsed(p, from, to, this.dice));
    const previous = from < 0 ? this.off : this.spots[from].pieces;
    const current = this.spots[to].pieces;
    if (!current.length || current[0] === p) {
      previous.splice(previous.findIndex(p => p === p), 1);
      current.push(p);
      if (from < 0) {
        this.moves.push(p + ' ' + (to + 1));
      } else {
        this.moves.push(p + ' ' + (from + 1) + ' ' + (to + 1));
      }
    } else if (current.length === 1) {
      previous.splice(previous.findIndex(p => p === p), 1);
      this.off.push(current[0]);
      current[0] = p;
      this.moves.push(p + ' ' + (from + 1) + 'x' + (to + 1));
    }
  }

  getMoves(p: Piece, index: number, ds: number[]) {
    if (!ds?.length) return [];
    if (index != -1 && this.off.find(o => o === p)) return [];
    if (index === -1 && p === 'b') {
      index = 24;
    }
    const result: number[] = [];
    const np = p === 'r' ? 'b' : 'r';
    for (const d of ds) {
      const i = p === 'r' ? index + d : index - d;
      if (i < 0) continue;
      if (i > 23) continue;
      if (this.spots[i].pieces.length > 1 && this.spots[i].pieces[0] === np) continue;
      result.push(i, ...this.getMoves(p, index, without(ds, d)));
    }
    return uniq(result);
  }

  getDiceUsed(p: Piece, from: number, to: number, ds: number[]) {
    if (from === -1 && p === 'b') {
      from = 24;
    }
    const result: number[] = [];
    const np = p === 'r' ? 'b' : 'r';
    for (const d of ds) {
      const i = p === 'r' ? from + d : from - d;
      if (i < 0) continue;
      if (i > 23) continue;
      if (p === 'r' && i > to) continue;
      if (p === 'b' && i < to) continue;
      if (this.spots[i].pieces.length > 1 && this.spots[i].pieces[0] === np) continue;
      if (i === to) {
        result.push(d);
      } else {
        result.push(...this.getDiceUsed(p, i, to, without(ds, d)));
      }
    }
    return result;
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

  clearMoves() {
    for (const s of this.spots) s.move = false;
  }

  setMoves(index: number) {
    const p = this.spots[index].pieces[0];
    if (p !== this.turn) return this.clearMoves();
    const ds = this.getDice(p);
    const moves = this.getMoves(p, index, ds);
    for (const s of this.spots) {
      s.move = !!moves.find(m => m === s.index);
    }
  }

  setMovesOff(p: Piece) {
    const ds = this.getDice(p);
    const moves = this.getMoves(p, -1, ds);
    for (const s of this.spots) {
      s.move = !!moves.find(m => m === s.index);
    }
  }

  get dice() {
    if (!this.turn) return [];
    return this.getDice(this.turn);
  }

  getDice(p: Piece) {
    let result = filter([...this.redDice, ...this.blackDice], d => !!d);
    if (result.length !== 2) {
      // You can use dice show if you win the initial roll
      result = [...p === 'r' ? this.redDice : this.blackDice];
    }
    if (result[0] === result[1]) {
      // Doubles
      result.push(...result);
    }
    for (const u of this.diceUsed) {
      result.splice(result.indexOf(u), 1);
    }
    return result;
  }

  getAllMoves() {
    if (!this.turn) return [];
    const result: number[] = this.getMoves(this.turn, -1, this.dice);
    for (let i = 0; i < 24; i++) {
      const p = this.spots[i].pieces[0];
      if (p !== this.turn) continue;
      result.push(...this.getMoves(p, i, this.dice));
    }
    return result;
  }

  roll(p: Piece) {
    const ds = p === 'r' ? this.redDice : this.blackDice;
    if (ds[1] && this.getAllMoves().length) throw $localize`Must move`;
    if (!this.turn) {
      if (ds[0]) return;
      ds[0] = this.r();
      this.moves.push(`${p} ${ds[0]}-0`);
    } else {
      if (this.turn === p) throw $localize`Not your turn`;
      this.turn = p;
      ds[0] = this.r();
      ds[1] = this.r();
      this.moves.push(`${p} ${ds[0]}-${ds[1]}`)
    }
    if (!this.turn && this.redDice[0] && this.blackDice[0]) {
      this.turn = this.redDice[0] > this.blackDice[0] ? 'r' : 'b';
    }
    this.rolling = p;
    delay(() => this.rolling = undefined, 3400);
    this.diceUsed = [];
    this.save();
  }

  r() {
    // TODO: Hash cursor
    return Math.floor(Math.random() * 6) + 1;
  }
}
