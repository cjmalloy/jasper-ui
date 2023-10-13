import { CdkDragDrop, CdkDropListGroup } from '@angular/cdk/drag-drop';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import { Square } from 'chess.js';
import { delay, filter, range, uniq } from 'lodash-es';
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

  board: string[] = [];
  turn?: Piece;
  bar: Piece[] = [];
  spots: Spot[] = [];
  moveRedOff = false;
  moveBlackOff = false;
  moves: number[][] = [];

  bounce = -1;
  start = -1;
  winner?: Piece;
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
            const lastMove = this.incoming = parseInt(move.split(/\D+/g).filter(m => !!m).pop()!) - 1;
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
    this.board.length = 0;
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

  get first() {
    if (this.diceUsed.length) return false;
    return !this.redDice[1] && !this.blackDice[1];
  }

  get closed() {
    if (this.turn === 'r') {
      for (let i = 0; i < 18; i++) if (this.spots[i].pieces[0] === 'r') return false;
      return true;
    } else {
      for (let i = 6; i < 24; i++) if (this.spots[i].pieces[0] === 'b') return false;
      return true;
    }
  }

  get redPips() {
    return this.spots.flatMap(s => s.pieces.filter(p => p === 'r')).length;
  }

  get blackPips() {
    return this.spots.flatMap(s => s.pieces.filter(p => p === 'b')).length;
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
      this.onClickBar(this.turn!);
    } else {
      this.onClick(index);
    }
    const dim = Math.floor(this.el.nativeElement.offsetWidth / 24);
    const fontSize = Math.floor(1.5 * dim);
    document.body.style.setProperty('--drag-piece-size', fontSize + 'px');
  }

  reset(board?: string) {
    delete this.turn;
    this.board = [];
    this.bar = [];
    this.diceUsed = [];
    this.redDice = [];
    this.blackDice = [];
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
      for (const m of board.split('\n').map(m => m.trim()).filter(m => !!m)) {
        const parts = m.split(/[\s/*()]+/g).filter(p => !!p);
        const p = parts[0] as Piece;
        if (m.includes('-')) {
          const ds = p === 'r' ? this.redDice : this.blackDice;
          ds[0] = parseInt(m[2]);
          ds[1] = parseInt(m[4]);
          this.board.push(`${p} ${ds[0]}-${ds[1]}`);
          this.diceUsed = [];
          if (!this.turn && this.redDice[0] && this.blackDice[0]) {
            if (this.redDice[0] === this.blackDice[0]) {
              this.redDice = [];
              this.blackDice = [];
            } else {
              this.turn = this.redDice[0] > this.blackDice[0] ? 'r' : 'b';
            }
          } else if (this.turn) {
            this.turn = p;
          }
        } else {
          const bar = m.includes('bar');
          const off = m.includes('off');
          const from = bar ? 0 : parseInt(parts[1]);
          const to = off ? -1 : parseInt(parts[2]);
          const multiple = parseInt(parts[3] || '1');
          for (let i = 0; i < multiple; i++) {
            this.move(p, from - 1, to - 1);
          }
        }
        this.moves = this.getAllMoves();
      }
    }
    if (!this.redPips) {
      this.moves = [];
      this.winner = 'r';
    } else if (!this.blackPips) {
      this.moves = [];
      this.winner = 'b';
    }
  }

  drawPiece(p: string) {
    return p === 'r' ? '🔴️' : '⚫️';
  }

  drop(event: CdkDragDrop<number, number, Piece>) {
    this.move(event.item.data, event.previousContainer.data, event.container.data);
    this.check();
  }

  move(p: Piece, from: number, to: number) {
    if (from === to) return;
    if (!this.moves[from]?.includes(to)) throw $localize`Illegal Move`;
    const dice = this.getDiceUsed(p, from, to, this.dice);
    this.diceUsed.push(...dice);
    const previous = from < 0 ? this.bar : this.spots[from].pieces;
    previous.splice(previous.findIndex(p => p === p), 1);
    if (to === -2) {
      this.pushMove(p, from, to);
      return;
    }
    let path = from < 0 ? (p === 'r' ? 0 : 24) : from;
    for (const d of dice.map(d => p=== 'r' ? d : -d)) {
      path += d;
      const hop = this.spots[path].pieces;
      if (hop.length === 1 && hop[0] !== p) {
        this.bar.push(p === 'r' ? 'b' : 'r');
        hop.length = 0;
      }
    }
    const current = this.spots[to].pieces;
    if (!current?.length || current[0] === p) {
      current?.push(p);
      this.pushMove(p, from, to);
    } else if (current.length === 1) {
      this.bar.push(current[0]);
      current[0] = p;
      this.pushMove(p, from, to, true);
    }
  }

  pushMove(p: Piece, from: number, to: number, hit?: boolean) {
    const last = this.board[this.board.length-1];
    const move = p + ' ' + (from < 0 ? 'bar' : from + 1) + '/' + (to < 0 ? 'off' : to + 1) + (hit ? '*' : '');
    const base = last.replace(/\(\d+\)|\*/g, '');
    if (base === move.replace(/\(\d+\)|\*/g, '')) {
      hit = last.includes('*');
      const multiple = base.match(/\((\d+)\)/)?.[0] || '2';
      this.board[this.board.length-1] = base + (hit ? '*' : '') + '(' + multiple + ')';
    } else {
      this.board.push(move);
    }
  }

  getMoves(p: Piece, index: number, ds: number[]) {
    if (!ds?.length) return [];
    if (index != -1 && this.bar.find(o => o === p)) return [];
    if (index === -1) {
      const off = this.bar.filter(o => o === p);
      if (!off.length) return [];
    }
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
      const rest = [...ds];
      rest.splice(ds.indexOf(d), 1);
      result.push(i, ...this.getMoves(p, i, rest));
    }
    if (this.closed) {
      const needDice = p === 'r' ? 24 - index : index + 1;
      for (let i = 6; i > needDice; i--) {
        const spot = this.spots[p === 'r' ? 24 - i : i - 1];
        for (const p of spot.pieces) {
          if (ds.includes(i)) {
            if (p === this.turn) {
              result.push(-2);
              break;
            } else {
              ds.splice(ds.indexOf(i), 1);
            }
          }
        }
      }
      if (ds.find(d => d >= needDice)) {
        result.push(-2);
      }
    }
    return uniq(result);
  }

  getDiceUsed(p: Piece, from: number, to: number, ds: number[]): number[] {
    if (from === -1 && p === 'b') {
      from = 24;
    }
    if (to === -2) {
      const d = p === 'r' ? 24 - from : from + 1;
      for (let i = d; i <= 6; i++) {
        if (ds.includes(i)) return [i];
      }
    }
    if (this.doubles) {
      const result: number[] = [];
      if (to < 0) {
        to = p === 'r' ? 24 : 0;
      }
      result.length = Math.abs(from - to) / ds[0];
      result.fill(ds[0]);
      return result;
    }
    const np = p === 'r' ? 'b' : 'r';
    for (const d of ds) {
      const i = p === 'r' ? from + d : from - d;
      if (i < 0) continue;
      if (i > 23) continue;
      if (p === 'r' && i > to) continue;
      if (p === 'b' && i < to) continue;
      if (this.spots[i].pieces.length > 1 && this.spots[i].pieces[0] === np) continue;
      if (i === to) {
        return [d];
      } else {
        const rest = [...ds];
        rest.splice(ds.indexOf(d), 1);
        const used = this.getDiceUsed(p, i, to, rest);
        if (used.length) return [d, ...used];
      }
    }
    return [];
  }

  check() {
    this.save();
    this.moves = [];
    if (!this.redPips) {
      this.winner = 'r';
    } else if (!this.blackPips) {
      this.winner = 'b';
    } else {
      this.moves = this.getAllMoves();
    }
    this.clearMoves();
  }

  save() {
    const comment = this.patchingComment = this.board.join('  \n');
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
    this.moveRedOff = this.moveBlackOff = false;
  }

  onClick(index: number) {
    const p = this.spots[index].pieces[0];
    if (this.turn && this.start >= 0 && this.moves[this.start]?.includes(index)) {
      this.move(this.turn, this.start, index);
      this.check();
    }
    this.start = -1;
    if (p !== this.turn) return this.clearMoves();
    const moves = this.moves[index];
    if (!moves) return this.clearMoves();
    this.start = index;
    for (const s of this.spots) {
      s.move = moves.find(m => m === s.index) !== undefined;
    }
    this.moveRedOff = this.turn === 'r' && moves.includes(-2);
    this.moveBlackOff = this.turn === 'b' && moves.includes(-2);
  }

  onClickBar(p: Piece) {
    const moves = this.moves[-1];
    if (!moves) return this.clearMoves();
    for (const s of this.spots) {
      s.move = moves.find(m => m === s.index) !== undefined;
    }
    this.moveRedOff = this.moveBlackOff = false;
  }

  moveDouble(event: Event, index: number) {
    event.preventDefault();
    if (!this.turn) return;
    const ds = this.dice[0] + (this.dice[1] || 0);
    const to = this.turn === 'r' ? index + ds : index - ds;
    this.move(this.turn, index, to);
    this.check();
  }

  moveBarDouble(event: Event, p: Piece) {
    event.preventDefault();
    if (p !== this.turn) return;
    const ds = this.dice[0] + (this.dice[1] || 0);
    const to = p === 'r' ? ds : 24 - ds;
    this.move(this.turn, -1, to);
    this.check();
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
    // TODO: Moves that result in not all dice used are illegal if possible to use all dice
    // TODO: If you can play one number but not both, you must play the higher one
    if (!this.turn) return [];
    const result: number[][] = [];
    const bar = this.getMoves(this.turn, -1, this.dice);
    if (bar.length) {
      result.length = 1;
      result[-1] = bar;
      return result;
    }
    for (let i = 0; i < 24; i++) {
      const p = this.spots[i].pieces[0];
      if (p !== this.turn) continue;
      const ms = this.getMoves(p, i, this.dice);
      if (ms.length) result[i] = ms;
    }
    return result;
  }

  roll(p: Piece) {
    const ds = p === 'r' ? this.redDice : this.blackDice;
    if (this.winner) throw $localize`Game Over`;
    if ((!this.first || this.turn !== p) && this.moves.length) throw $localize`Must move`;
    if (!this.turn) {
      if (ds[0]) return;
      ds[0] = this.r();
      this.board.push(`${p} ${ds[0]}-0`);
    } else {
      if (!this.first && this.turn === p) throw $localize`Not your turn`;
      this.turn = p;
      ds[0] = this.r();
      ds[1] = this.r();
      this.board.push(`${p} ${ds[0]}-${ds[1]}`)
    }
    if (!this.turn && this.redDice[0] && this.blackDice[0]) {
      if (this.redDice[0] === this.blackDice[0]) {
        this.redDice = [];
        this.blackDice = [];
      } else {
        this.turn = this.redDice[0] > this.blackDice[0] ? 'r' : 'b';
      }
    }
    this.rolling = p;
    delay(() => this.rolling = undefined, 3400);
    this.diceUsed = [];
    this.moves = this.getAllMoves();
    this.save();
  }

  r() {
    // TODO: Hash cursor
    return Math.floor(Math.random() * 6) + 1;
  }
}
