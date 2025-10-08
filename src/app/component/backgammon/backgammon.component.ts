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
import { hasTag } from '../../util/tag';

export type Piece = 'r' | 'b';
export type Spot = {
  index: number,
  col: number,
  red: boolean,
  move?: boolean,
  top: boolean
  pieces: Piece[],
};

// Game state type - represents the complete backgammon game state
type GameState = {
  board: string[];
  turn?: Piece;
  bar: Piece[];
  spots: Spot[];
  redOff: Piece[];
  blackOff: Piece[];
  redDice: number[];
  blackDice: number[];
  diceUsed: number[];
  winner?: Piece;
  lastMovedSpots: Record<number, number>;
  lastMovedOff: Record<Piece, number>;
};

type AnimationState = {
  // For rolling animations
  rollingPiece?: Piece;
  postRedDice?: number[];
  postBlackDice?: number[];
  postTurn?: Piece;
  postBoard?: string[];
  postDiceUsed?: number[];
  postMoves?: number[][];
  postLastMovedSpots?: Record<number, number>;
  postLastMovedOff?: Record<Piece, number>;
  // For move animations
  from?: number;
  to?: number;
  piece?: Piece;
  spotsState?: Spot[];
  barState?: Piece[];
  turnState?: Piece;
  fromStackIndex?: number;
  toStackIndex?: number;
  // Post-move states for updating after animation
  postSpotsState?: Spot[];
  postBarState?: Piece[];
  postRedOff?: Piece[];
  postBlackOff?: Piece[];
};

function renderMove(p: Piece, from: number, to: number, hit?: boolean) {
  return p + ' ' + (from < 0 ? 'bar' : from + 1) + '/' + (to < 0 ? 'off' : to + 1) + (hit ? '*' : '');
}

// Pure functions for game logic - these don't modify state

function getRedPips(state: GameState): number {
  return state.spots.flatMap(s => s.pieces.filter(p => p === 'r')).length;
}

function getBlackPips(state: GameState): number {
  return state.spots.flatMap(s => s.pieces.filter(p => p === 'b')).length;
}

function getRedBar(state: GameState): Piece[] {
  return state.bar.filter(b => b === 'r');
}

function getBlackBar(state: GameState): Piece[] {
  return state.bar.filter(b => b === 'b');
}

function isClosed(state: GameState): boolean {
  if (state.turn === 'r') {
    for (let i = 0; i < 18; i++) if (state.spots[i].pieces[0] === 'r') return false;
    return true;
  } else if (state.turn === 'b') {
    for (let i = 6; i < 24; i++) if (state.spots[i].pieces[0] === 'b') return false;
    return true;
  }
  return false;
}

function isInRedHome(state: GameState): boolean {
  for (let i = 18; i < 24; i++) if (state.spots[i].pieces[0] === 'b') return true;
  return false;
}

function isInBlackHome(state: GameState): boolean {
  for (let i = 0; i < 7; i++) if (state.spots[i].pieces[0] === 'r') return true;
  return false;
}

function getDice(state: GameState, p: Piece): number[] {
  let result = filter([...state.redDice, ...state.blackDice], d => !!d);
  if (result.length !== 2) {
    // You can use dice shown if you win the initial roll
    result = [...(p === 'r' ? state.redDice : state.blackDice)];
  }
  if (result[0] === result[1]) {
    // Doubles
    result.push(...result);
  }
  for (const u of state.diceUsed) {
    result.splice(result.indexOf(u), 1);
  }
  return result;
}

function areDoubles(state: GameState): boolean {
  const ds = state.turn === 'r' ? state.redDice : state.blackDice;
  return ds[0] === ds[1];
}

function isFirstRoll(state: GameState): boolean {
  if (state.diceUsed.length) return false;
  return !state.redDice[1] && !state.blackDice[1];
}

// Get valid moves for a piece at a given index
function getPieceMoves(state: GameState, p: Piece, index: number, ds: number[]): number[] {
  if (!ds?.length) return [];
  const bar = state.bar;
  const spots = state.spots;
  
  if (index != -1 && bar.find(o => o === p)) return [];
  if (index === -1) {
    const off = bar.filter(o => o === p);
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
    if (spots[i].pieces.length > 1 && spots[i].pieces[0] === np) continue;
    const rest = [...ds];
    rest.splice(ds.indexOf(d), 1);
    result.push(i, ...getPieceMoves(state, p, i, rest));
  }
  if (isClosed(state)) {
    const needDice = p === 'r' ? 24 - index : index + 1;
    if (ds.find(d => d === needDice)) {
      result.push(-2);
    } else {
      for (let i = 6; i > needDice; i--) {
        const spot = spots[p === 'r' ? 24 - i : i - 1];
        for (const piece of spot.pieces) {
          if (piece !== state.turn) break;
          if (!ds.find(d => d >= i)) return uniq(result);
        }
      }
      if (ds.find(d => d >= needDice)) {
        result.push(-2);
      }
    }
  }
  return uniq(result);
}

// Get all valid moves for the current player
function getAllMoves(state: GameState): number[][] {
  if (!state.turn) return [];
  const result: number[][] = [];
  const ds = getDice(state, state.turn);
  const bar = getPieceMoves(state, state.turn, -1, ds);
  if (bar.length) {
    result.length = 1;
    result[-1] = bar;
    return result;
  }
  for (let i = 0; i < 24; i++) {
    const p = state.spots[i].pieces[0];
    if (p !== state.turn) continue;
    const ms = getPieceMoves(state, p, i, ds);
    if (ms.length) result[i] = ms;
  }
  return result;
}

// Get which dice are used for a specific move
function getDiceUsed(state: GameState, p: Piece, from: number, to: number, ds: number[]): number[] {
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
    throw $localize`Illegal move ${renderMove(p, from, to)}`;
  }
  if (areDoubles(state)) {
    const result: number[] = [];
    if (to < 0) {
      to = p === 'r' ? 24 : -1;
    }
    result.length = Math.abs(from - to) / ds[0];
    result.fill(ds[0]);
    return result;
  }
  const np = p === 'r' ? 'b' : 'r';
  const spots = state.spots;
  for (const d of ds) {
    const i = p === 'r' ? from + d : from - d;
    if (i < 0) continue;
    if (i > 23) continue;
    if (p === 'r' && i > to) continue;
    if (p === 'b' && i < to) continue;
    if (spots[i].pieces.length > 1 && spots[i].pieces[0] === np) continue;
    if (i === to) {
      return [d];
    } else {
      const rest = [...ds];
      rest.splice(ds.indexOf(d), 1);
      const used = getDiceUsed(state, p, i, to, rest);
      if (used.length) return [d, ...used];
    }
  }
  return [];
}

// Apply a move to the game state, returning a new state
function applyMove(state: GameState, p: Piece, from: number, to: number): GameState {
  // Deep copy the state
  const newState: GameState = {
    ...state,
    board: [...state.board],
    bar: [...state.bar],
    spots: state.spots.map(s => ({ ...s, pieces: [...s.pieces] })),
    redOff: [...state.redOff],
    blackOff: [...state.blackOff],
    redDice: [...state.redDice],
    blackDice: [...state.blackDice],
    diceUsed: [...state.diceUsed],
    lastMovedSpots: { ...state.lastMovedSpots },
    lastMovedOff: { ...state.lastMovedOff },
  };

  if (from === to) return newState;
  
  const dice = getDiceUsed(newState, p, from, to, getDice(newState, p));
  newState.diceUsed.push(...dice);
  
  const previous = from < 0 ? newState.bar : newState.spots[from].pieces;
  previous.splice(previous.findIndex(c => c === p), 1);
  
  let hit = false;
  let path = from < 0 ? (p === 'r' ? -1 : 24) : from;
  for (const d of dice.map(d => p === 'r' ? d : -d)) {
    path += d;
    if (path < 0 || path > 23) break;
    const hop = newState.spots[path].pieces;
    if (hop.length === 1 && hop[0] !== p) {
      if (hit) {
        newState.board.push(renderMove(p, from, path, hit));
        from = path;
      }
      hit = true;
      newState.bar.push(p === 'r' ? 'b' : 'r');
      hop.length = 0;
    }
  }
  
  const current = to < 0 ? undefined : newState.spots[to].pieces;
  if (!current?.length || current[0] === p) {
    current?.push(p);
    // If piece is going off, add to off collection
    if (to < 0) {
      if (p === 'r') {
        newState.redOff.push(p);
      } else {
        newState.blackOff.push(p);
      }
    }
    newState.board.push(renderMove(p, from, to, hit));
  } else if (current.length === 1) {
    newState.bar.push(current[0]);
    current[0] = p;
    newState.board.push(renderMove(p, from, to, hit));
  }
  
  // Update glow tracking
  if (to >= 0 && to < 24) {
    newState.lastMovedSpots[to] = (newState.lastMovedSpots[to] || 0) + 1;
  } else if (to < 0) {
    newState.lastMovedOff[newState.turn!]++;
  }
  if (from >= 0 && from < 24) {
    newState.lastMovedSpots[from] = (newState.lastMovedSpots[from] || 1) - 1;
  } else if (from < 0) {
    newState.lastMovedOff[newState.turn!]++;
  }
  
  // Check for winner
  if (!getRedPips(newState)) {
    newState.winner = 'r';
  } else if (!getBlackPips(newState)) {
    newState.winner = 'b';
  }
  
  return newState;
}

// Apply a dice roll to the game state
function applyRoll(state: GameState, p: Piece, d1: number, d2: number): GameState {
  const newState: GameState = {
    ...state,
    board: [...state.board],
    bar: [...state.bar],
    spots: state.spots.map(s => ({ ...s, pieces: [...s.pieces] })),
    redOff: [...state.redOff],
    blackOff: [...state.blackOff],
    redDice: [...state.redDice],
    blackDice: [...state.blackDice],
    diceUsed: [],
    lastMovedSpots: {},
    lastMovedOff: { 'r': 0, 'b': 0 },
  };

  const ds = p === 'r' ? newState.redDice : newState.blackDice;
  ds[0] = d1;
  ds[1] = d2;
  newState.board.push(`${p} ${d1}-${d2}`);

  if (!newState.turn && newState.redDice[0] && newState.blackDice[0]) {
    if (newState.redDice[0] === newState.blackDice[0]) {
      newState.redDice = [];
      newState.blackDice = [];
    } else {
      newState.turn = newState.redDice[0] > newState.blackDice[0] ? 'r' : 'b';
    }
  } else if (newState.turn) {
    newState.turn = p;
  }

  return newState;
}





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
  redOff: Piece[] = [];
  blackOff: Piece[] = [];
  lastMovedSpots: Record<number, number> = {};
  lastMovedOff: Record<Piece, number> = { 'r': 0, 'b': 0 };

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
  translate?: number;
  animating = false;
  animationQueue: AnimationState[] = [];
  animatedPiece?: { piece: Piece; from: number; to: number; fromStackIndex?: number; toStackIndex?: number };

  private resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.onResize()) || undefined;
  private watch?: Subscription;
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
        if (update.includes('-')) {
          const lastRoll = update.split(' ')[0] as Piece;

          // Compute the state after the roll without modifying current state
          const newState = this.computeRollState(update);

          // Queue the rolling animation with post-animation state
          this.queueAnimation({
            rollingPiece: lastRoll,
            postRedDice: newState.redDice,
            postBlackDice: newState.blackDice,
            postTurn: newState.turn,
            postBoard: newState.board,
            postDiceUsed: newState.diceUsed,
            postMoves: newState.moves,
            postLastMovedSpots: {},
            postLastMovedOff: { 'r': 0, 'b': 0 }
          });
        } else if (update.includes('/')) {
          // Parse the move
          const parts = update.split(/[\s/*()]+/g).filter(p => !!p);
          const p = parts[0] as Piece;
          const bar = update.includes('bar');
          const off = update.includes('off');
          const hit = update.includes('*');
          const from = bar ? -1 : parseInt(parts[1]) - 1;
          const to = off ? -2 : parseInt(parts[2]) - 1;

          // Capture state before move including stack positions
          const spotsStateBefore = this.spots.map(s => ({ ...s, pieces: [...s.pieces] }));
          const barStateBefore = [...this.bar];
          const redOffBefore = [...this.redOff];
          const blackOffBefore = [...this.blackOff];
          const turnBefore = this.turn;

          // Track the source stack position of the moving piece
          let fromStackIndex = -1;
          if (from >= 0 && from < 24) {
            const sourceSpot = spotsStateBefore[from];
            fromStackIndex = sourceSpot.pieces.filter(piece => piece === p).length - 1;
          } else if (from === -1) {
            const sourceBar = p === 'r' ? barStateBefore.filter(b => b === 'r') : barStateBefore.filter(b => b === 'b');
            fromStackIndex = sourceBar.length - 1;
          }

          // If there's a hit, capture which piece is being bumped and its stack position
          let bumpedPiece: Piece | undefined;
          let bumpedFromStackIndex = -1;
          if (hit && to >= 0 && to < 24) {
            const targetSpot = spotsStateBefore[to];
            if (targetSpot.pieces.length === 1 && targetSpot.pieces[0] !== p) {
              bumpedPiece = targetSpot.pieces[0];
              bumpedFromStackIndex = 0; // It's the only piece at this position
            }
          }

          // Compute post-move glow state statelessly
          const postLastMovedSpots = { ...this.lastMovedSpots };
          const postLastMovedOff = { ...this.lastMovedOff };
          
          if (to >= 0 && to < 24) {
            postLastMovedSpots[to] = (postLastMovedSpots[to] || 0) + 1;
          } else if (to === -2) {
            // Piece moved off
            postLastMovedOff[p]++;
          }

          // Execute the move
          this.load([update]);

          // Capture POST-move state
          const spotsStateAfter = this.spots.map(s => ({ ...s, pieces: [...s.pieces] }));
          const barStateAfter = [...this.bar];
          const redOffAfter = [...this.redOff];
          const blackOffAfter = [...this.blackOff];

          // Compute destination stack index from post-move state
          let toStackIndex = -1;
          if (to >= 0 && to < 24) {
            const destSpot = spotsStateAfter[to];
            toStackIndex = destSpot.pieces.filter(piece => piece === p).length - 1;
          } else if (to === -1) {
            const destBar = p === 'r' ? barStateAfter.filter(b => b === 'r') : barStateAfter.filter(b => b === 'b');
            toStackIndex = destBar.length - 1;
          } else if (to === -2) {
            const destOff = p === 'r' ? redOffAfter : blackOffAfter;
            toStackIndex = destOff.length - 1;
          }

          // Queue animation for bumped piece first (so it happens before the moving piece)
          if (bumpedPiece !== undefined && to >= 0) {
            // Compute bumped piece destination stack index from post-move state
            const bumpedDestBar = bumpedPiece === 'r' ? barStateAfter.filter(b => b === 'r') : barStateAfter.filter(b => b === 'b');
            const bumpedToStackIndex = bumpedDestBar.length - 1;

            this.queueAnimation({
              from: to,
              to: -1, // To bar
              piece: bumpedPiece,
              spotsState: spotsStateBefore,
              barState: barStateBefore,
              turnState: turnBefore,
              fromStackIndex: bumpedFromStackIndex,
              toStackIndex: bumpedToStackIndex,
              postSpotsState: spotsStateAfter,
              postBarState: barStateAfter,
              postRedOff: redOffAfter,
              postBlackOff: blackOffAfter,
              postLastMovedSpots,
              postLastMovedOff
            });
          }

          // Queue animation for main move only if not moving to off
          if (to !== -2) {
            this.queueAnimation({
              from,
              to,
              piece: p,
              spotsState: spotsStateBefore,
              barState: barStateBefore,
              turnState: turnBefore,
              fromStackIndex,
              toStackIndex,
              postSpotsState: spotsStateAfter,
              postBarState: barStateAfter,
              postRedOff: redOffAfter,
              postBlackOff: blackOffAfter,
              postLastMovedSpots,
              postLastMovedOff
            });
          }
        } else {
          this.load([update]);
        }

        // Start processing animations and rolling queue if not already animating
        if (!this.animating) {
          this.processAnimationQueue();
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
    this.watch?.unsubscribe();
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
    const dim = Math.floor(hasTag('plugin/fullscreen', this.ref) ? Math.min(
      screen.width / 28,
      screen.height / 26.5
    ) : Math.min(
      (innerWidth - 4) / 28,
      (this.el.nativeElement.parentElement?.offsetWidth || screen.width) / 28,
      (innerHeight - 20) / 26,
    ));
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
    this.redOff = [];
    this.blackOff = [];
    this.lastMovedSpots = {};
    this.lastMovedOff = { 'r': 0, 'b': 0 };
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

  /**
   * Compute the state after applying a roll without modifying current state
   */
  computeRollState(rollUpdate: string): {
    redDice: number[];
    blackDice: number[];
    turn: Piece;
    board: string[];
    diceUsed: number[];
    moves: number[][];
  } {
    const parts = rollUpdate.split(/[\s/*()]+/g).filter(p => !!p);
    const p = parts[0] as Piece;

    const redDice = [...this.redDice];
    const blackDice = [...this.blackDice];
    let turn = this.turn!;
    const board = [...this.board];
    const diceUsed: number[] = [];

    const ds = p === 'r' ? redDice : blackDice;
    ds[0] = parseInt(rollUpdate[2]);
    ds[1] = parseInt(rollUpdate[4]);
    board.push(`${p} ${ds[0]}-${ds[1]}`);

    if (!turn && redDice[0] && blackDice[0]) {
      if (redDice[0] === blackDice[0]) {
        redDice.length = 0;
        blackDice.length = 0;
      } else {
        turn = redDice[0] > blackDice[0] ? 'r' : 'b';
      }
    } else if (turn) {
      turn = p;
    }

    // Compute moves based on new state
    const moves = this.getAllMovesForState(turn, redDice, blackDice, diceUsed);

    return { redDice, blackDice, turn, board, diceUsed, moves };
  }

  /**
   * Helper to compute moves for a given state without modifying component state
   */
  getAllMovesForState(turn: Piece | undefined, redDice: number[], blackDice: number[], diceUsed: number[]): number[][] {
    if (!turn) return [];

    // Temporarily set state to compute moves
    const oldTurn = this.turn;
    const oldRedDice = this.redDice;
    const oldBlackDice = this.blackDice;
    const oldDiceUsed = this.diceUsed;

    this.turn = turn;
    this.redDice = redDice;
    this.blackDice = blackDice;
    this.diceUsed = diceUsed;

    const moves = this.getAllMoves();

    // Restore original state
    this.turn = oldTurn;
    this.redDice = oldRedDice;
    this.blackDice = oldBlackDice;
    this.diceUsed = oldDiceUsed;

    return moves;
  }

  load(moves?: string[]) {
    if (!moves) return;
    for (const m of moves) {
      const parts = m.split(/[\s/*()]+/g).filter(p => !!p);
      const p = parts[0] as Piece;
      if (m.includes('-')) {
        // Clear glow on new roll
        this.lastMovedSpots = {};
        this.lastMovedOff = { 'r': 0, 'b': 0 };
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
          // Track glow for moves when loading directly (not through animation system)
          const actualTo = to - 1;
          if (actualTo >= 0 && actualTo < 24) {
            this.lastMovedSpots[actualTo] = (this.lastMovedSpots[actualTo] || 0) + 1;
          } else if (actualTo === -2) {
            this.lastMovedOff[p]++;
          }
        }
      }
    }
    if (!this.redPips) {
      this.winner = 'r';
    } else if (!this.blackPips) {
      this.winner = 'b';
    }
    this.moves = this.getAllMoves();
  }

  drawPiece(p?: string) {
    if (!p) return '';
    return p === 'r' ? '🔴️' : '⚫️';
  }

  drop(event: CdkDragDrop<number, number, Piece>) {
    this.move(event.item.data, event.previousContainer.data, event.container.data);
    this.check();
    this.save(event.item.data, event.previousContainer.data, event.container.data);
  }

  move(p: Piece, from: number, to: number) {
    if (from === to) return;
    if (!this.getAllMoves()[from]?.includes(to)) {
      throw $localize`Illegal move ${renderMove(p, from, to)}`;
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
          this.board.push(renderMove(p, from, path, hit));
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
      // If piece is going off, add to off collection
      if (to < 0) {
        if (p === 'r') {
          this.redOff.push(p);
        } else {
          this.blackOff.push(p);
        }
      }
      this.board.push(renderMove(p, from, to, hit));
    } else if (current.length === 1) {
      this.bar.push(current[0]);
      current[0] = p;
      this.board.push(renderMove(p, from, to, hit));
    }
    this.moves = this.getAllMoves();
    if (to >= 0 && to < 24) {
      this.lastMovedSpots[to] = (this.lastMovedSpots[to] || 0) + 1;
    } else if (to < 0) {
      this.lastMovedOff[this.turn!]++;
    }
    if (from >= 0 && from < 24) {
      this.lastMovedSpots[from] = (this.lastMovedSpots[from] || 1) - 1;
    } else if (from < 0) {
      this.lastMovedOff[this.turn!]++;
    }
  }

  save(p: Piece, from: number, to: number, hit?: boolean) {
    if (from === to) return;
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
      throw $localize`Illegal move ${renderMove(p, from, to)}`;
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
    if (!this.redPips) {
      this.winner = 'r';
    } else if (!this.blackPips) {
      this.winner = 'b';
    }
    this.clearMoves();
  }

  clearMoves() {
    for (const s of this.spots) s.move = false;
    this.moveRedOff = this.moveBlackOff = false;
  }

  onClick(index: number) {
    this.moves = this.getAllMoves();
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
    const move = this.moves[index];
    if (!move) return this.clearMoves();
    this.start = index;
    for (const s of this.spots) {
      s.move = move.find(m => m === s.index) !== undefined;
    }
    this.moveRedOff = this.turn === 'r' && move.includes(-2);
    this.moveBlackOff = this.turn === 'b' && move.includes(-2);
  }

  onClickBar() {
    this.moves = this.getAllMoves();
    this.start = -1;
    const move = this.moves[-1];
    if (!move) return this.clearMoves();
    for (const s of this.spots) {
      s.move = move.find(m => m === s.index) !== undefined;
    }
    this.moveRedOff = this.moveBlackOff = false;
  }

  onClickOff() {
    this.moves = this.getAllMoves();
    if (this.start !== undefined && this.moves[this.start]?.includes(-2)) {
      this.move(this.turn!, this.start, -2);
      this.check();
      this.save(this.turn!, this.start, -2);
    }
  }

  moveHighest(event: Event, index: number) {
    this.moves = this.getAllMoves();
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
    this.moves = this.getAllMoves();
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
    this.moves = this.getAllMoves();
    if ((!this.first || this.turn !== p) && this.moves.length) throw $localize`Must move`;

    // Clear glow when rolling (new turn)
    this.lastMovedSpots = {};
    this.lastMovedOff = { 'r': 0, 'b': 0 };

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

  queueAnimation(state: AnimationState) {
    this.animationQueue.push(state);
    if (!this.animating) this.processAnimationQueue();
  }

  processAnimationQueue() {
    this.animating = false;
    delete this.animatedPiece;
    delete this.rolling;
    if (this.animationQueue.length === 0) return;

    this.animating = true;
    const animation = this.animationQueue.shift()!;

    // Handle rolling animation
    if (animation.rollingPiece) {
      this.rolling = animation.rollingPiece;
      if (animation.postRedDice) this.redDice = animation.postRedDice;
      if (animation.postBlackDice) this.blackDice = animation.postBlackDice;
      if (animation.postTurn) this.turn = animation.postTurn;
      if (animation.postBoard) this.board = animation.postBoard;
      if (animation.postDiceUsed) this.diceUsed = animation.postDiceUsed;
      if (animation.postLastMovedSpots !== undefined) this.lastMovedSpots = animation.postLastMovedSpots;
      if (animation.postLastMovedOff !== undefined) this.lastMovedOff = animation.postLastMovedOff;
      this.moves = this.getAllMoves();
      delay(() => {
        this.processAnimationQueue();
      }, 750);
      return;
    }

    // Handle move animation
    // Keep the PRE-move state during animation so piece is still at source
    this.spots = animation.spotsState!;
    this.bar = animation.barState!;
    this.turn = animation.turnState;

    // Calculate coordinates for CSS animation
    const fromSpot = animation.from === -1 ? null : this.spots.find(s => s.index === animation.from!);
    const toSpot = animation.to === -2 || animation.to === -1 ? null : this.spots.find(s => s.index === animation.to!);

    // Calculate grid positions
    // From position
    let fromCol = 0;
    let fromRow = 0;
    if (animation.from === -1) {
      // From bar
      fromCol = 7; // Bar is at column 8
      fromRow = animation.piece === 'r' ? 1 : 0; // Red bar at bottom, black bar at top
    } else if (fromSpot) {
      fromCol = fromSpot.col > 6 ? fromSpot.col + 1 : fromSpot.col; // Account for bar gap
      fromRow = fromSpot.top ? 0 : 1;
    }

    // To position
    let toCol = 0;
    let toRow = 0;
    if (animation.to === -1) {
      // To bar (piece being bumped)
      toCol = 7;
      toRow = animation.piece === 'r' ? 1 : 0; // Red bar at bottom, black bar at top
    } else if (animation.to === -2) {
      // To off (both at column 1)
      toCol = 0;
      toRow = animation.piece === 'r' ? 1 : 0; // Red off at bottom row, black off at top row
    } else if (toSpot) {
      toCol = toSpot.col > 6 ? toSpot.col + 1 : toSpot.col; // Account for bar gap
      toRow = toSpot.top ? 0 : 1;
    }
    console.log(fromCol, fromRow, toCol, toRow);

    // Calculate stack offset adjustments
    // Pieces stack vertically, with stacked pieces having additional y offsets
    // For top spots, pieces stack downward; for bottom spots, upward
    let fromStackOffsetX = 0;
    let fromStackOffsetY = (animation.fromStackIndex || 0);
    let toStackOffsetX = 0;
    let toStackOffsetY = (animation.toStackIndex || 0);

    if (animation.fromStackIndex) {
      if (animation.fromStackIndex > 4) {
        fromStackOffsetX -= 0.05;
        fromStackOffsetY -= 5.2;
        if (animation.fromStackIndex > 9) {
          fromStackOffsetX -= 0.05;
          fromStackOffsetY -= 5.2;
        }
      }
    }
    // Adjust sign based on whether it's a top or bottom spot
    if (fromSpot && !fromSpot.top) {
      fromStackOffsetY = -fromStackOffsetY + 0.1;
      fromStackOffsetX = -fromStackOffsetX;
    }

    if (animation.toStackIndex) {
      if (animation.toStackIndex > 4) {
        toStackOffsetX -= 0.05;
        toStackOffsetY -= 5.2;
        if (animation.toStackIndex > 9) {
          toStackOffsetX -= 0.05;
          toStackOffsetY -= 5.2;
        }
      }
    }
    // Adjust sign based on whether it's a top or bottom spot
    if (toSpot && !toSpot.top) {
      toStackOffsetY = -toStackOffsetY + 0.1;
      toStackOffsetX = -toStackOffsetX;
    }


    const xFrom = fromCol + fromStackOffsetX;
    const yFrom = fromRow * 12 + fromStackOffsetY * 0.86;
    const xTo = toCol + toStackOffsetX;
    const yTo = toRow * 12 + toStackOffsetY * 0.86;

    console.log(xFrom, yFrom, xTo, yTo);
    this.el.nativeElement.style.setProperty('--xFrom', '' + xFrom * 2);
    this.el.nativeElement.style.setProperty('--yFrom', '' + yFrom * 2);
    this.el.nativeElement.style.setProperty('--xTo', '' + xTo * 2);
    this.el.nativeElement.style.setProperty('--yTo', '' + yTo * 2);

    requestAnimationFrame(() => {
      this.animatedPiece = {
        piece: animation.piece!,
        from: animation.from!,
        to: animation.to!,
        fromStackIndex: animation.fromStackIndex,
        toStackIndex: animation.toStackIndex
      };
      const totalDuration = 1500;
      delay(() => {
        if (animation.postSpotsState) this.spots = animation.postSpotsState;
        if (animation.postBarState) this.bar = animation.postBarState;
        if (animation.postRedOff) this.redOff = animation.postRedOff;
        if (animation.postBlackOff) this.blackOff = animation.postBlackOff;
        if (animation.postTurn) this.turn = animation.postTurn;
        if (animation.postLastMovedSpots !== undefined) this.lastMovedSpots = animation.postLastMovedSpots;
        if (animation.postLastMovedOff !== undefined) this.lastMovedOff = animation.postLastMovedOff;
        this.moves = this.getAllMoves();
        this.processAnimationQueue();
      }, totalDuration);
    });
  }
}
