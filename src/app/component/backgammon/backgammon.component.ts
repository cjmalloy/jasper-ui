import { CdkDragDrop, CdkDropListGroup } from '@angular/cdk/drag-drop';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import { defer, delay, filter, range, uniq } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, Observable, of, Subscription } from 'rxjs';
import { Ref } from '../../model/ref';
import { ActionService } from '../../service/action.service';
import { Store } from '../../store/store';

export type Piece = 'r' | 'b';
export type Spot = {
  index: number,
  col: number,
  red: boolean,
  move?: boolean,
  bounce?: 0,
  top: boolean
  pieces: Piece[],
};

const MAX_PLAYERS = 2;

@Component({
  standalone: false,
  selector: 'app-backgammon',
  templateUrl: './backgammon.component.html',
  styleUrls: ['./backgammon.component.scss'],
  hostDirectives: [CdkDropListGroup],
  host: {'class': 'backgammon-board'}
})
export class BackgammonComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  private disposers: IReactionDisposer[] = [];

  @Input()
  @HostBinding('class.red')
  red = false; // TODO: Save in local storage
  @Input()
  ref?: Ref;
  @Input()
  text? = '';
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
  redBarBounce = -1;
  blackBarBounce = -1;
  start?: number;
  winner?: Piece;
  rolling?: Piece;
  dragSource = -1;
  redDice: number[] = [];
  blackDice: number[] = [];
  diceUsed: number[] = [];
  @HostBinding('class.loaded')
  loaded = false;
  @HostBinding('class.resizing')
  resizing = 0;

  private resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.onResize()) || undefined;
  private watch?: Subscription;
  /**
   * Queued animation.
   */
  private incoming = -1;
  /**
   * Queued red bar animation.
   */
  private incomingRedBar = -1;
  /**
   * Queued black bar animation.
   */
  private incomingBlackBar = -1;
  /**
   * Queued animation.
   */
  private incomingRolling?: Piece;
  private append$!: (value: string) => Observable<string>;

  constructor(
    private store: Store,
    private actions: ActionService,
    private el: ElementRef<HTMLDivElement>,
  ) {
    this.disposers.push(autorun(() => {
      if (this.store.eventBus.event === 'flip' && this.store.eventBus.ref?.url === this.ref?.url) {
        this.red = !this.red;
        defer(() => this.store.eventBus.fire('flip-done'));
      }
    }));
  }

  ngOnInit(): void {
    this.resizeObserver?.observe(this.el.nativeElement.parentElement!);
    this.onResize();
  }

  init() {
    this.el.nativeElement.style.setProperty('--red-name', '"🔴️ ' + (this.bgConf?.redName || $localize`Red`) + '"');
    this.el.nativeElement.style.setProperty('--black-name', '"⚫️ ' + (this.bgConf?.blackName || $localize`Black`) + '"');
    if (!this.watch) {
      const watch = this.actions.append(this.ref!);
      this.append$ = watch.append$;
      this.watch = watch.updates$.pipe(
        catchError(err => {
          if (err.url) {
            // Game history rewritten
            alert($localize`Game History Rewritten!\n\nPlease Reload.`);
          }
          return of();
        }),
      ).subscribe(update => {
        this.load([update]);
        if (update.includes('-')) {
          const lastRoll = this.incomingRolling = update.split(' ')[0] as Piece;
          requestAnimationFrame(() => {
            if (lastRoll != this.incomingRolling) return;
            this.rolling = this.incomingRolling;
            delay(() => this.rolling = undefined, 3400);
          });
        }
        if (update.includes('/')) {
          const lastMove = this.incoming = parseInt(update.split(/\D+/g).filter(m => !!m).pop()!);
          this.incomingRedBar = update.includes('*') && update.startsWith('b') ? 1 : 0;
          this.incomingBlackBar = update.includes('*') && update.startsWith('r') ? 1 : 0;
          requestAnimationFrame(() => {
            if (lastMove != this.incoming) return;
            this.setBounce(this.incoming);
            this.redBarBounce ||= this.incomingRedBar;
            this.blackBarBounce ||= this.incomingBlackBar;
            clearTimeout(this.bounce);
            this.bounce = delay(() => {
              this.clearBounce();
              this.bounce = -1;
              this.incomingRedBar = this.incomingBlackBar = -1;
            }, 3400);
          });
        }
      });
    }
    this.reset(this.ref?.comment || this.text);
  }

  ngAfterViewInit() {
    defer(() => this.loaded = true);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref || changes.text) {
      const newRef = changes.ref?.firstChange || changes.ref?.previousValue?.url != changes.ref?.currentValue?.url;
      if (!this.ref || newRef) {
        this.watch?.unsubscribe();
        if (this.ref || this.text != null) this.init();
      }
    }
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.resizeObserver?.disconnect();
  }

  get bgConf() {
    return this.ref?.plugins?.['plugin/backgammon'];
  }

  get local() {
    return !this.ref?.created || this.ref.upload || this.ref?.origin === this.store.account.origin;
  }

  get redBar() {
    return this.bar.filter(b => b === 'r');
  }

  get blackBar() {
    return this.bar.filter(b => b === 'b');
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

  get inRedHome() {
    for (let i = 18; i < 24; i++) if (this.spots[i].pieces[0] === 'b') return true;
    return false;
  }

  get inBlackHome() {
    for (let i = 0; i < 7; i++) if (this.spots[i].pieces[0] === 'r') return true;
    return false;
  }

  get redPips() {
    return this.spots.flatMap(s => s.pieces.filter(p => p === 'r')).length;
  }

  get blackPips() {
    return this.spots.flatMap(s => s.pieces.filter(p => p === 'b')).length;
  }

  @HostListener('window:resize')
  onResize() {
    const dim = Math.floor(Math.min(
      innerWidth - 4,
      innerHeight - 20,
      this.el.nativeElement.parentElement?.offsetWidth || screen.width,
    ) / 28);
    const fontSize = Math.floor(1.5 * dim);
    this.el.nativeElement.style.setProperty('--dim', dim + 'px')
    this.el.nativeElement.style.setProperty('--piece-size', fontSize + 'px');
    clearTimeout(this.resizing);
    this.resizing = delay(() => this.resizing = 0, 1000);
  }

  onDragStarted(index: number) {
    this.dragSource = index;
    if (index < 0) {
      this.onClickBar();
    } else {
      delete this.start;
      this.onClick(index);
    }
    const dim = Math.floor(this.el.nativeElement.offsetWidth / 24);
    const fontSize = Math.floor(1.5 * dim);
    document.body.style.setProperty('--drag-piece-size', fontSize + 'px');
  }

  reset(board = '') {
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
    this.load(board.split('\n').map(m => m.trim()).filter(m => !!m));
  }

  load(moves?: string[]) {
    this.moves = this.getAllMoves();
    if (!moves) return;
    for (const m of moves) {
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
    this.save(event.item.data, event.previousContainer.data, event.container.data);
  }

  move(p: Piece, from: number, to: number) {
    if (from === to) return;
    if (!this.moves[from]?.includes(to)) {
      alert($localize`Illegal Move`);
      return;
    }
    const dice = this.getDiceUsed(p, from, to, this.dice);
    this.diceUsed.push(...dice);
    const previous = from < 0 ? this.bar : this.spots[from].pieces;
    previous.splice(previous.findIndex(c => c === p), 1);
    let hit = false;
    let path = from < 0 ? (p === 'r' ? -1 : 24) : from;
    for (const d of dice.map(d => p=== 'r' ? d : -d)) {
      path += d;
      if (path < 0 || path > 23) break;
      const hop = this.spots[path].pieces;
      if (hop.length === 1 && hop[0] !== p) {
        if (hit) {
          this.pushMove(p, from, path, hit);
          from = path;
        }
        hit = true;
        this.bar.push(p === 'r' ? 'b' : 'r');
        hop.length = 0;
      }
    }
    const current = to < 0 ? undefined : this.spots[to].pieces;
    if (!current?.length || current[0] === p) {
      current?.push(p);
      this.pushMove(p, from, to, hit);
    } else if (current.length === 1) {
      this.bar.push(current[0]);
      current[0] = p;
      this.pushMove(p, from, to, hit);
    }
  }

  pushMove(p: Piece, from: number, to: number, hit?: boolean) {
    // TODO: compress history
    // const last = this.board[this.board.length-1] || undefined;
    const move = p + ' ' + (from < 0 ? 'bar' : from + 1) + '/' + (to < 0 ? 'off' : to + 1) + (hit ? '*' : '');
    // const base = last?.replace(/\(\d+\)/g, '');
    // if (last && !hit && !last.includes('*') && base === move.replace(/\(\d+\)/g, '')) {
    //   const multiple = parseInt(last.match(/\((\d+)\)/)?.[1] || '1') + 1;
    //   this.board[this.board.length-1] = base + (hit ? '*' : '') + '(' + multiple + ')';
    // } else {
      this.board.push(move);
    // }
  }

  save(p: Piece, from: number, to: number, hit?: boolean) {
    const move = p + ' ' + (from < 0 ? 'bar' : from + 1) + '/' + (to < 0 ? 'off' : to + 1) + (hit ? '*' : '');
    this.append$(move).subscribe();
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
      if (i < 0 || i > 23) continue;
      if (this.spots[i].pieces.length > 1 && this.spots[i].pieces[0] === np) continue;
      const rest = [...ds];
      rest.splice(ds.indexOf(d), 1);
      // TODO: check closed moves with piece missing
      result.push(i, ...this.getMoves(p, i, rest));
    }
    if (this.closed) {
      const needDice = p === 'r' ? 24 - index : index + 1;
      if (ds.find(d => d === needDice)) {
        result.push(-2);
      } else {
        for (let i = 6; i > needDice; i--) {
          const spot = this.spots[p === 'r' ? 24 - i : i - 1];
          for (const p of spot.pieces) {
            if (p !== this.turn) break;
            if (!ds.find(d => d >= i)) return uniq(result)
          }
        }
        if (ds.find(d => d >= needDice)) {
          result.push(-2);
        }
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
      if (ds.includes(d)) return [d];
      const u: number[] = [];
      let v = 0;
      for (const i of ds) {
        if (i > d) continue;
        v += i;
        u.push(i);
        if (v >= d) return u;
      }
      u.length = 0;
      v = 0;
      for (const i of ds) {
        v += i;
        u.push(i);
        if (v >= d) return u;
      }
      throw $localize`Illegal move`;
    }
    if (this.doubles) {
      const result: number[] = [];
      if (to < 0) {
        to = p === 'r' ? 24 : -1;
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

  clearMoves() {
    for (const s of this.spots) s.move = false;
    this.moveRedOff = this.moveBlackOff = false;
  }

  clearBounce() {
    for (const s of this.spots) {
      s.bounce = 0;
    }
  }

  setBounce(b: number) {
    for (const s of this.spots) {
      if (b === s.index) s.bounce!++;
    }
  }

  onClick(index: number) {
    const p = this.spots[index].pieces[0];
    if (this.turn && this.start !== undefined && this.moves[this.start]?.includes(index)) {
      this.move(this.turn, this.start, index);
      this.check();
      this.save(this.turn, this.start, index);
    }
    if (index === this.start) {
      delete this.start;
      return this.clearMoves();
    }
    delete this.start;
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

  onClickBar() {
    this.start = -1;
    const moves = this.moves[-1];
    if (!moves) return this.clearMoves();
    for (const s of this.spots) {
      s.move = moves.find(m => m === s.index) !== undefined;
    }
    this.moveRedOff = this.moveBlackOff = false;
  }

  onClickOff() {
    if (this.start !== undefined && this.moves[this.start]?.includes(-2)) {
      this.move(this.turn!, this.start, -2);
      this.check();
      this.save(this.turn!, this.start, -2);
    }
  }

  moveHighest(event: Event, index: number) {
    event.preventDefault();
    if (!this.turn || !this.moves[index]) return;
    const ds = this.dice;
    let d = Math.max(ds[0], (ds[1] || 0));
    let to = this.turn === 'r' ? index + d : index - d;
    if (to < 0 || to > 23) to = -2;
    if (!this.moves[index].includes(to)) {
      d = Math.min(ds[0], (ds[1] || 7));
      to = this.turn === 'r' ? index + d : index - d;
      if (to < 0 || to > 23) to = -2;
      if (!this.moves[index].includes(to)) return;
    }
    this.move(this.turn, index, to);
    this.check();
    this.save(this.turn, index, to);
  }

  moveBarHighest(event: Event) {
    event.preventDefault();
    if (!this.turn || !this.moves[-1]) return;
    const ds = this.dice;
    let d = Math.max(ds[0], (ds[1] || 0));
    let to = this.turn === 'r' ? d - 1 : 24 - d;
    if (!this.moves[-1].includes(to)) {
      d = Math.min(ds[0], (ds[1] || 7));
      to = this.turn === 'r' ? d - 1 : 24 - d;
      if (!this.moves[-1].includes(to)) return;
    }
    this.move(this.turn, -1, to);
    this.check();
    this.save(this.turn, -1, to);
  }

  get dice() {
    if (!this.turn) return [];
    return this.getDice(this.turn);
  }

  getDice(p: Piece) {
    let result = filter([...this.redDice, ...this.blackDice], d => !!d);
    if (result.length !== 2) {
      // You can use dice shown if you win the initial roll
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

  get gammon() {
    return this.winner === 'r'  && this.blackPips === 15
      || this.winner === 'b'  && this.redPips === 15;
  }

  get backgammon() {
    return this.winner === 'r'  && this.blackPips === 15 && (this.blackBar.length || this.inRedHome)
      || this.winner === 'b'  && this.redPips === 15 && (this.redBar.length || this.inBlackHome);
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
    let move = '';
    if (!this.turn) {
      if (ds[0]) return;
      ds[0] = this.r();
      this.board.push(move = `${p} ${ds[0]}-0`);
    } else {
      if (!this.first && this.turn === p) throw $localize`Not your turn`;
      this.turn = p;
      ds[0] = this.r();
      ds[1] = this.r();
      this.board.push(move = `${p} ${ds[0]}-${ds[1]}`)
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
    delay(() => this.rolling = undefined, 750);
    this.diceUsed = [];
    this.moves = this.getAllMoves();
    this.append$(move).subscribe();
  }

  r() {
    // TODO: Hash cursor
    return Math.floor(Math.random() * 6) + 1;
  }
}
