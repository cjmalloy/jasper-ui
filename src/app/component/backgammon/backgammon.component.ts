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
import { cloneDeep, defer, delay, filter, range, uniq } from 'lodash-es';
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
  moves: number[][];
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
  rollingPiece?: Piece;
  from?: number;
  to?: number;
  piece?: Piece;
  fromStackIndex?: number;
  toStackIndex?: number;
  pre: GameState;
  post: GameState;
};

function getAnimation(state: GameState, update: string): AnimationState | null {
  if (update.includes('-')) {
    // Parse roll
    const parts = update.split(/[\s/*()]+/g).filter(p => !!p);
    const p = parts[0] as Piece;
    const d1 = parseInt(update[2]);
    const d2 = parseInt(update[4]);
    const newState = applyRoll(state, p, d1, d2);
    return {
      pre: state,
      post: newState,
      rollingPiece: p,
    };
  }
  if (update.includes('/')) {
    // Parse the move
    const parts = update.split(/[\s/*()]+/g).filter(p => !!p);
    const p = parts[0] as Piece;
    const bar = update.includes('bar');
    const off = update.includes('off');
    const from = bar ? -1 : parseInt(parts[1]) - 1;
    const to = off ? -2 : parseInt(parts[2]) - 1;

    // Track the source stack position of the moving piece
    let fromStackIndex = -1;
    if (from >= 0 && from < 24) {
      const sourceSpot = state.spots[from];
      fromStackIndex = sourceSpot.pieces.filter(piece => piece === p).length - 1;
    } else if (from === -1) {
      const sourceBar = p === 'r' ? getRedBar(state) : getBlackBar(state);
      fromStackIndex = sourceBar.length - 1;
    }

    // Use pure function to compute new state
    const newState = applyMove(state, p, from, to);

    // Compute destination stack index from post-move state
    let toStackIndex = -1;
    if (to >= 0 && to < 24) {
      const destSpot = newState.spots[to];
      toStackIndex = destSpot.pieces.filter(piece => piece === p).length - 1;
    } else if (to === -1) {
      const destBar = p === 'r' ? getRedBar(newState) : getBlackBar(newState);
      toStackIndex = destBar.length - 1;
    } else if (to === -2) {
      const destOff = p === 'r' ? newState.redOff : newState.blackOff;
      toStackIndex = destOff.length - 1;
    }
    return {
      pre: state,
      post: newState,
      from,
      to,
      piece: p,
      fromStackIndex,
      toStackIndex,
    };
  }
  console.log('unknown update:', update);
  return null;
}

function renderMove(p: Piece, from: number, to: number, hit?: boolean) {
  return p + ' ' + (from < 0 ? 'bar' : from + 1) + '/' + (to < 0 ? 'off' : to + 1) + (hit ? '*' : '');
}

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

function getDice(state: GameState, turn: Piece): number[] {
  let result = filter([...state.redDice, ...state.blackDice], d => !!d);
  if (result.length !== 2) {
    // You can use dice shown if you win the initial roll
    result = [...(turn === 'r' ? state.redDice : state.blackDice)];
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
  const newState = cloneDeep(state);
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
  newState.moves = getAllMoves(newState);
  return newState;
}

// Apply a dice roll to the game state
function applyRoll(state: GameState, p: Piece, d1: number, d2: number): GameState {
  const newState = {
    ...cloneDeep(state),
    diceUsed: [],
    lastMovedSpots: { },
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
  newState.moves = getAllMoves(newState);
  return newState;
}

function load(state: GameState, moves?: string[]) {
  if (!moves) return;
  for (const m of moves) {
    const parts = m.split(/[\s/*()]+/g).filter(p => !!p);
    const p = parts[0] as Piece;
    if (m.includes('-')) {
      // Clear glow on new roll
      state.lastMovedSpots = {};
      state.lastMovedOff = { 'r': 0, 'b': 0 };
      const ds = p === 'r' ? state.redDice : state.blackDice;
      ds[0] = parseInt(m[2]);
      ds[1] = parseInt(m[4]);
      state.board.push(`${p} ${ds[0]}-${ds[1]}`);
      state.diceUsed = [];
      if (!state.turn && state.redDice[0] && state.blackDice[0]) {
        if (state.redDice[0] === state.blackDice[0]) {
          state.redDice = [];
          state.blackDice = [];
        } else {
          state.turn = state.redDice[0] > state.blackDice[0] ? 'r' : 'b';
        }
      } else if (state.turn) {
        state.turn = p;
      }
      state.moves = getAllMoves(state);
    } else {
      const bar = m.includes('bar');
      const off = m.includes('off');
      const from = bar ? 0 : parseInt(parts[1]);
      const to = off ? -1 : parseInt(parts[2]);
      const multiple = parseInt(parts[3] || '1');
      for (let i = 0; i < multiple; i++) {
        loadMove(state, p, from - 1, to - 1);
        // Track glow for moves when loading directly (not through animation system)
        const actualTo = to - 1;
        if (actualTo >= 0 && actualTo < 24) {
          state.lastMovedSpots[actualTo] = (state.lastMovedSpots[actualTo] || 0) + 1;
        } else if (actualTo === -2) {
          state.lastMovedOff[p]++;
        }
      }
    }
  }
  if (!getRedPips(state)) {
    state.winner = 'r';
  } else if (!getBlackPips(state)) {
    state.winner = 'b';
  }
}

function loadMove(state: GameState, p: Piece, from: number, to: number) {
  if (from === to) return;
  if (!state.moves[from]?.includes(to)) {
    throw $localize`Illegal move ${renderMove(p, from, to)}`;
  }
  const dice = getDiceUsed(state, p, from, to, getDice(state, p));
  state.diceUsed.push(...dice);
  const previous = from < 0 ? state.bar : state.spots[from].pieces;
  previous.splice(previous.findIndex(c => c === p), 1);
  let hit = false;
  let path = from < 0 ? (p === 'r' ? -1 : 24) : from;
  for (const d of dice.map(d => p === 'r' ? d : -d)) {
    path += d;
    if (path < 0 || path > 23) break;
    const hop = state.spots[path].pieces;
    if (hop.length === 1 && hop[0] !== p) {
      if (hit) {
        state.board.push(renderMove(p, from, path, hit));
        from = path;
      }
      hit = true;
      state.bar.push(p === 'r' ? 'b' : 'r');
      hop.length = 0;
    }
  }
  const current = to < 0 ? undefined : state.spots[to].pieces;
  if (!current?.length || current[0] === p) {
    current?.push(p);
    // If piece is going off, add to off collection
    if (to < 0) {
      if (p === 'r') {
        state.redOff.push(p);
      } else {
        state.blackOff.push(p);
      }
    }
    state.board.push(renderMove(p, from, to, hit));
  } else if (current.length === 1) {
    state.bar.push(current[0]);
    current[0] = p;
    state.board.push(renderMove(p, from, to, hit));
  }
  state.moves = getAllMoves(state);
  if (to >= 0 && to < 24) {
    state.lastMovedSpots[to] = (state.lastMovedSpots[to] || 0) + 1;
  } else if (to < 0) {
    state.lastMovedOff[state.turn!]++;
  }
  if (from >= 0 && from < 24) {
    state.lastMovedSpots[from] = (state.lastMovedSpots[from] || 1) - 1;
  } else if (from < 0) {
    state.lastMovedOff[state.turn!]++;
  }
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

  state: GameState = {
    bar: [],
    blackDice: [],
    blackOff: [],
    board: [],
    diceUsed: [],
    lastMovedOff: { 'r': 0, 'b': 0 },
    lastMovedSpots: {},
    moves: [],
    redDice: [],
    redOff: [],
    spots: [],
  };
  moveRedOff = false;
  moveBlackOff = false;
  start?: number;
  rolling?: Piece;
  dragSource = -1;
  @HostBinding('class.loaded')
  loaded = false;
  @HostBinding('class.resizing')
  resizing = 0;
  @HostBinding('class.replay-mode')
  replayMode = false;
  translate?: number;
  animating = false;
  animationQueue: AnimationState[] = [];
  animatedPiece?: AnimationState;

  replayPosition = 0;
  replayPlaying = false;
  replaySpeed = 1; // 1x, 2x, 3x, 4x
  replayAnimations: AnimationState[] = [];
  importantEvents: number[] = [];
  importantEventTypes: Map<number, string> = new Map();

  private resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.onResize()) || undefined;
  private watch?: Subscription;
  private append$!: (value: string) => Observable<string>;
  private seeking = false;
  private animationHandler = 0;

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
        const state = getAnimation(this.lastState, update);
        if (state) {
          this.queueAnimation(state)
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
      } else if (changes.ref && !changes.ref.firstChange) {
        // Check if end game tags were added
        const prevEnded = !!(changes.ref.previousValue && (
          hasTag('plugin/backgammon/draw', changes.ref.previousValue) ||
          hasTag('plugin/backgammon/winner/r', changes.ref.previousValue) ||
          hasTag('plugin/backgammon/winner/b', changes.ref.previousValue)
        ));
        const nowEnded = this.isGameEnded;

        if (!prevEnded && nowEnded && !this.replayMode) {
          // Tags were added to end the game, enter replay mode
          defer(() => this.enterReplayMode());
        }
      }
    }
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.resizeObserver?.disconnect();
    this.watch?.unsubscribe();
    this.pauseReplay();
  }

  get bgConf() {
    return this.ref?.plugins?.['plugin/backgammon'];
  }

  get local() {
    return !this.ref?.created || this.ref.upload || this.ref?.origin === this.store.account.origin;
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
    this.state = {
      bar: [],
      blackDice: [],
      blackOff: [],
      board: [],
      diceUsed: [],
      lastMovedOff: { 'r': 0, 'b': 0 },
      lastMovedSpots: {},
      moves: [],
      redDice: [],
      redOff: [],
      spots: range(24).map(index => (<Spot>{ index, col: index < 12 ? index + 1 : 24 - index, red: !(index % 2), top: index < 12, pieces: [] as string[] })),
    };
    this.state.spots[ 0].pieces = [...'rr'] as Piece[];
    this.state.spots[ 5].pieces = [...'bbbbb'] as Piece[];
    this.state.spots[ 7].pieces = [...'bbb'] as Piece[];
    this.state.spots[11].pieces = [...'rrrrr'] as Piece[];
    this.state.spots[12].pieces = [...'bbbbb'] as Piece[];
    this.state.spots[16].pieces = [...'rrr'] as Piece[];
    this.state.spots[18].pieces = [...'rrrrr'] as Piece[];
    this.state.spots[23].pieces = [...'bb'] as Piece[];
    load(this.state, board.split('\n').map(m => m.trim()).filter(m => !!m));
    if (this.isGameEnded) defer(() => this.enterReplayMode());
  }

  get lastState(): GameState {
    return cloneDeep(this.animationQueue[0] ? this.animationQueue[this.animationQueue.length - 1].post : this.state);
  }

  set lastState(state: GameState) {
    this.queueAnimation({ pre: this.lastState, post: state });
  }

  drawPiece(p?: string) {
    if (!p) return '';
    return p === 'r' ? '🔴️' : '⚫️';
  }

  drop(event: CdkDragDrop<number, number, Piece>) {
    if (this.replayMode) return; // Don't allow moves in replay mode
    const p = event.item.data;
    const from = event.previousContainer.data;
    const to = event.container.data;
    if (from === to) return;
    if (!this.state.moves[from]?.includes(to)) {
      throw $localize`Illegal move ${renderMove(p, from, to)}`;
    }
    this.lastState = applyMove(this.lastState, p, from, to);
    this.check();
    this.save(p, from, to);
  }

  save(p: Piece, from: number, to: number, hit?: boolean) {
    if (from === to) return;
    const move = p + ' ' + (from < 0 ? 'bar' : from + 1) + '/' + (to < 0 ? 'off' : to + 1) + (hit ? '*' : '');
    this.append$(move).subscribe();
  }

  check() {
    if (!getRedPips(this.state)) {
      this.state.winner = 'r';
      // Enter replay mode when game ends during play
      if (!this.replayMode) {
        defer(() => this.enterReplayMode());
      }
    } else if (!getBlackPips(this.state)) {
      this.state.winner = 'b';
      // Enter replay mode when game ends during play
      if (!this.replayMode) {
        defer(() => this.enterReplayMode());
      }
    }
    this.clearMoves();
  }

  clearMoves() {
    for (const s of this.state.spots) s.move = false;
    this.moveRedOff = this.moveBlackOff = false;
  }

  onClick(index: number) {
    const p = this.state.spots[index].pieces[0];
    if (this.state.turn && this.start !== undefined && this.state.moves[this.start]?.includes(index)) {
      this.lastState = applyMove(this.lastState, this.state.turn, this.start, index);
      this.clearMoves();
      this.save(this.state.turn!, this.start, index);
      delete this.start;
      return;
    }
    if (index === this.start) {
      delete this.start;
      return this.clearMoves();
    }
    delete this.start;
    if (p !== this.state.turn) return this.clearMoves();
    const move = this.state.moves[index];
    if (!move) return this.clearMoves();
    this.start = index;
    for (const s of this.state.spots) {
      s.move = move.find(m => m === s.index) !== undefined;
    }
    this.moveRedOff = this.state.turn === 'r' && move.includes(-2);
    this.moveBlackOff = this.state.turn === 'b' && move.includes(-2);
  }

  onClickBar() {
    this.start = -1;
    const move = this.state.moves[-1];
    if (!move) return this.clearMoves();
    for (const s of this.state.spots) {
      s.move = move.find(m => m === s.index) !== undefined;
    }
    this.moveRedOff = this.moveBlackOff = false;
  }

  onClickOff() {
    if (this.start !== undefined && this.state.moves[this.start]?.includes(-2)) {
      this.lastState = applyMove(this.lastState, this.state.turn!, this.start, -2);
      this.clearMoves();
      this.save(this.state.turn!, this.start, -2);
      delete this.start;
    }
  }

  moveHighest(event: Event, index: number) {
    event.preventDefault();
    if (!this.state.turn || !this.state.moves[index]) return;
    const ds = getDice(this.state, this.state.turn);
    let d = Math.max(ds[0], (ds[1] || 0));
    let to = this.state.turn === 'r' ? index + d : index - d;
    if (to < 0 || to > 23) to = -2;
    if (!this.state.moves[index].includes(to)) {
      d = Math.min(ds[0], (ds[1] || 7));
      to = this.state.turn === 'r' ? index + d : index - d;
      if (to < 0 || to > 23) to = -2;
      if (!this.state.moves[index].includes(to)) return;
    }
    this.lastState = applyMove(this.lastState, this.state.turn, index, to);
    this.clearMoves();
    this.save(this.state.turn!, index, to);
  }

  moveBarHighest(event: Event) {
    event.preventDefault();
    if (!this.state.turn || !this.state.moves[-1]) return;
    const ds = getDice(this.state, this.state.turn);
    let d = Math.max(ds[0], (ds[1] || 0));
    let to = this.state.turn === 'r' ? d - 1 : 24 - d;
    if (!this.state.moves[-1].includes(to)) {
      d = Math.min(ds[0], (ds[1] || 7));
      to = this.state.turn === 'r' ? d - 1 : 24 - d;
      if (!this.state.moves[-1].includes(to)) return;
    }
    this.lastState = applyMove(this.lastState, this.state.turn, -1, to);
    this.clearMoves();
    this.save(this.state.turn!, -1, to);
  }

  get first() {
    return isFirstRoll(this.state);
  }

  get moves() {
    return this.state.moves;
  }

  get spots() {
    return this.state.spots;
  }

  get turn() {
    return this.state.turn;
  }

  get redDice() {
    return this.state.redDice;
  }

  get blackDice() {
    return this.state.blackDice;
  }

  get winner() {
    return this.state.winner;
  }

  get blackBar() {
    return getBlackBar(this.state);
  }

  get redBar() {
    return getRedBar(this.state);
  }

  get redOff() {
    return this.state.redOff;
  }

  get blackOff() {
    return this.state.blackOff;
  }

  get blackPips() {
    return getBlackPips(this.state);
  }

  get redPips() {
    return getRedPips(this.state);
  }

  get lastMovedOff() {
    return this.state.lastMovedOff;
  }

  get lastMovedSpots() {
    return this.state.lastMovedSpots;
  }

  get gammon() {
    return this.state.winner === 'r'  && this.blackPips === 15
      || this.state.winner === 'b'  && this.redPips === 15;
  }

  get backgammon() {
    return this.state.winner === 'r'  && this.blackPips === 15 && (this.blackBar.length || isInRedHome(this.state))
      || this.state.winner === 'b'  && this.redPips === 15 && (this.redBar.length || isInBlackHome(this.state));
  }

  roll(p: Piece) {
    if (this.replayMode) return; // Don't allow rolling in replay mode
    if (this.state.winner) throw $localize`Game Over`;
    if (this.state.turn && !isFirstRoll(this.state) && this.state.turn === p) throw $localize`Not your turn`;
    if (!isFirstRoll(this.state) && this.state.moves.length) throw $localize`Must move`;
    const ds = p === 'r' ? this.state.redDice : this.state.blackDice;
    if (!this.state.turn && ds[0]) return;
    this.rolling = p;
    delay(() => this.rolling = undefined, 750);
    const state = applyRoll(this.lastState, p, this.r(), this.state.turn ? this.r() : 0);
    this.append$(state.board[state.board.length - 1]).subscribe();
    this.lastState = state;
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
      this.state = { ...animation.post };
      this.rolling = animation.rollingPiece;
      delay(() => {
        this.processAnimationQueue();
      }, 750);
      return;
    }

    if (animation.from === undefined) {
      this.state = { ...animation.post };
      if (!this.state.diceUsed.length) {
        this.rolling = this.state.turn;
      }
      delay(() => {
        this.processAnimationQueue();
      }, 750);
      return;
    }

    // Calculate coordinates for CSS animation
    const fromSpot = animation.from === -1 ? null : animation.pre.spots.find(s => s.index === animation.from!);
    const toSpot = animation.to === -2 || animation.to === -1 ? null : animation.pre.spots.find(s => s.index === animation.to!);

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

    this.el.nativeElement.style.setProperty('--xFrom', '' + xFrom * 2);
    this.el.nativeElement.style.setProperty('--yFrom', '' + yFrom * 2);
    this.el.nativeElement.style.setProperty('--xTo', '' + xTo * 2);
    this.el.nativeElement.style.setProperty('--yTo', '' + yTo * 2);

    requestAnimationFrame(() => {
      this.animatedPiece = animation;
      const totalDuration = 1500;
      delay(() => {
        this.state = { ...animation.post };
        this.check();
        this.processAnimationQueue();
      }, totalDuration);
    });
  }

  // Replay mode controls
  get isGameEnded() {
    return !!this.state.winner || hasTag('plugin/backgammon/draw', this.ref) ||
           hasTag('plugin/backgammon/winner/r', this.ref) ||
           hasTag('plugin/backgammon/winner/b', this.ref);
  }

  precomputeReplayAnimations() {
    this.replayAnimations = [];

    // Start with initial state
    let currentState: GameState = {
      bar: [],
      blackDice: [],
      blackOff: [],
      board: [],
      diceUsed: [],
      lastMovedOff: { 'r': 0, 'b': 0 },
      lastMovedSpots: {},
      moves: [],
      redDice: [],
      redOff: [],
      spots: range(24).map(index => (<Spot>{ index, col: index < 12 ? index + 1 : 24 - index, red: !(index % 2), top: index < 12, pieces: [] as string[] })),
    };
    currentState.spots[ 0].pieces = [...'rr'] as Piece[];
    currentState.spots[ 5].pieces = [...'bbbbb'] as Piece[];
    currentState.spots[ 7].pieces = [...'bbb'] as Piece[];
    currentState.spots[11].pieces = [...'rrrrr'] as Piece[];
    currentState.spots[12].pieces = [...'bbbbb'] as Piece[];
    currentState.spots[16].pieces = [...'rrr'] as Piece[];
    currentState.spots[18].pieces = [...'rrrrr'] as Piece[];
    currentState.spots[23].pieces = [...'bb'] as Piece[];

    // Build animation for each move
    for (const move of this.state.board) {
      const animation = getAnimation(currentState, move);
      if (animation) {
        this.replayAnimations.push(animation);
        currentState = animation.post;
      }
    }
  }

  detectImportantEvents() {
    const events: number[] = [];
    this.importantEventTypes.clear();

    let currentTurnStart = 0;
    let piecesHitThisTurn = 0;
    let redAllHome = false;
    let blackAllHome = false;

    for (let i = 0; i < this.replayAnimations.length; i++) {
      const animation = this.replayAnimations[i];
      const move = this.state.board[i];
      const parts = move.split(/[\s/*()]+/g).filter(p => !!p);
      const p = parts[0] as Piece;

      // Check for double 6s (rolls)
      if (animation.rollingPiece && move.includes('6-6')) {
        events.push(i);
        this.importantEventTypes.set(i, $localize`Double 6s`);
      }

      // Track turn changes
      if (animation.rollingPiece) {
        // New roll - check if we had >1 hit in previous turn
        if (piecesHitThisTurn > 1) {
          if (!this.importantEventTypes.has(currentTurnStart)) {
            events.push(currentTurnStart);
            this.importantEventTypes.set(currentTurnStart, $localize`${piecesHitThisTurn} pieces hit`);
          }
        }
        currentTurnStart = i;
        piecesHitThisTurn = 0;
      } else if (move.includes('*')) {
        // Piece was hit (bumped to bar) - indicated by asterisk
        piecesHitThisTurn++;
      }

      // Check if red or black all pieces are in home (using post state)
      const state = animation.post;
      if (!redAllHome && p === 'r') {
        let inHome = true;
        for (let j = 0; j < 18; j++) {
          if (state.spots[j].pieces.find(piece => piece === 'r')) {
            inHome = false;
            break;
          }
        }
        if (state.bar.find(b => b === 'r')) inHome = false;
        if (inHome && state.redOff.length < 15) {
          redAllHome = true;
          events.push(i);
          this.importantEventTypes.set(i, $localize`Red all home`);
        }
      }

      if (!blackAllHome && p === 'b') {
        let inHome = true;
        for (let j = 6; j < 24; j++) {
          if (state.spots[j].pieces.find(piece => piece === 'b')) {
            inHome = false;
            break;
          }
        }
        if (state.bar.find(b => b === 'b')) inHome = false;
        if (inHome && state.blackOff.length < 15) {
          blackAllHome = true;
          events.push(i);
          this.importantEventTypes.set(i, $localize`Black all home`);
        }
      }
    }

    // Check last turn
    if (piecesHitThisTurn > 1) {
      if (!this.importantEventTypes.has(currentTurnStart)) {
        events.push(currentTurnStart);
        this.importantEventTypes.set(currentTurnStart, $localize`${piecesHitThisTurn} pieces hit`);
      }
    }

    return [...new Set(events)].sort((a, b) => a - b);
  }

  enterReplayMode() {
    if (!this.isGameEnded) return;

    this.replayMode = true;
    this.replayPosition = 0;
    this.precomputeReplayAnimations();
    this.importantEvents = this.detectImportantEvents();
    this.replayToPosition(this.replayAnimations.length + 1);
  }

  replayToPosition(position: number | string) {
    if (this.replayPlaying) throw 'must pause before seeking';
    const pos = typeof position === 'string' ? parseFloat(position) : position;
    if (isNaN(pos) || pos < 0) return;
    delete this.animatedPiece;
    delete this.rolling;

    if (pos >= this.replayAnimations.length) {
      this.replayPosition = this.replayAnimations.length + 1;
      this.state = cloneDeep(this.replayAnimations[this.replayAnimations.length - 1].post);
    } else {
      this.replayPosition = pos;
      this.state = cloneDeep(this.replayAnimations[pos].pre);
    }
  }

  playReplay() {
    if (this.replayPlaying) return;
    this.replayPlaying = true;
    if (this.replayPosition >= this.replayAnimations.length - 1) this.replayPosition = 0;
    this.processReplayAnimationQueue();
  }

  processReplayAnimationQueue() {
    delete this.animatedPiece;
    delete this.rolling;
    if (!this.replayPlaying) return;

    if (this.replayAnimations.length === 0) {
      this.replayPlaying = false;
      this.replayPosition = 0;
      return;
    }

    if (this.replayPosition > this.replayAnimations.length) this.replayPosition = 0;
    const animation = this.replayAnimations[this.replayPosition];

    // Handle rolling animation
    if (animation.rollingPiece) {
      this.state = { ...animation.post };
      this.rolling = animation.rollingPiece;
      const duration = 750 / this.replaySpeed;
      delay(() => {
        this.replayPosition++;
        this.processReplayAnimationQueue();
      }, duration);
      return;
    }

    // Calculate coordinates for CSS animation
    const fromSpot = animation.from === -1 ? null : animation.pre.spots.find(s => s.index === animation.from!);
    const toSpot = animation.to === -2 || animation.to === -1 ? null : animation.pre.spots.find(s => s.index === animation.to!);

    // Calculate grid positions
    let fromCol = 0;
    let fromRow = 0;
    if (animation.from === -1) {
      fromCol = 7;
      fromRow = animation.piece === 'r' ? 1 : 0;
    } else if (fromSpot) {
      fromCol = fromSpot.col > 6 ? fromSpot.col + 1 : fromSpot.col;
      fromRow = fromSpot.top ? 0 : 1;
    }

    let toCol = 0;
    let toRow = 0;
    if (animation.to === -1) {
      toCol = 7;
      toRow = animation.piece === 'r' ? 1 : 0;
    } else if (animation.to === -2) {
      toCol = 0;
      toRow = animation.piece === 'r' ? 1 : 0;
    } else if (toSpot) {
      toCol = toSpot.col > 6 ? toSpot.col + 1 : toSpot.col;
      toRow = toSpot.top ? 0 : 1;
    }

    // Calculate stack offset adjustments
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
    if (toSpot && !toSpot.top) {
      toStackOffsetY = -toStackOffsetY + 0.1;
      toStackOffsetX = -toStackOffsetX;
    }

    const xFrom = fromCol + fromStackOffsetX;
    const yFrom = fromRow * 12 + fromStackOffsetY * 0.86;
    const xTo = toCol + toStackOffsetX;
    const yTo = toRow * 12 + toStackOffsetY * 0.86;

    const totalDuration = 1500 / this.replaySpeed;
    this.el.nativeElement.style.setProperty('--xFrom', '' + xFrom * 2);
    this.el.nativeElement.style.setProperty('--yFrom', '' + yFrom * 2);
    this.el.nativeElement.style.setProperty('--xTo', '' + xTo * 2);
    this.el.nativeElement.style.setProperty('--yTo', '' + yTo * 2);
    this.el.nativeElement.style.setProperty('--move-duration', totalDuration + 'ms');

    requestAnimationFrame(() => {
      this.animatedPiece = animation;
      this.animationHandler = delay(() => {
        if (this.replayPlaying) {
          this.state = { ...animation.post };
          if (this.replayPosition === this.replayAnimations.length - 1) {
            // Don't loop
            this.pauseReplay();
          }
          this.replayPosition++;
          this.processReplayAnimationQueue();
        }
      }, totalDuration);
    });
  }

  pauseReplay() {
    if (this.animationHandler) {
      clearTimeout(this.animationHandler);
      this.animationHandler = 0;
    }
    this.replayPlaying = false;
    delete this.animatedPiece;
    delete this.rolling;
  }

  startSeeking() {
    if (this.replayPlaying) {
      this.seeking = true;
      this.pauseReplay();
    }
  }

  seek(position: number | string) {
    this.pauseReplay();
    this.replayToPosition(position);
  }

  endSeeking() {
    if (this.seeking) {
      this.seeking = false;
      this.playReplay();
    }
  }

  snapToEvent(eventPos: number) {
    if (this.replayPlaying) {
      this.pauseReplay();
      this.replayToPosition(eventPos);
      this.playReplay();
    } else {
      this.replayToPosition(eventPos);
    }
  }

  getEventEmoji(eventPos: number): string {
    const eventType = this.importantEventTypes.get(eventPos);
    if (!eventType) return '';

    if (eventType.includes('Double 6s')) return '🎲️🎲️';
    if (eventType.includes('Red all home')) return '🔴️🏠️';
    if (eventType.includes('Black all home')) return '⚫️🏠️';
    if (eventType.includes('hit')) return eventType.split(' ')[0] + '❌️';
    return '';
  }

  replayFastForward() {
    // Cycle through speeds: 1x -> 2x -> 3x -> 4x -> 1x
    this.replaySpeed = this.replaySpeed >= 4 ? 1 : this.replaySpeed + 1;
    if (this.replayPlaying) {
      this.pauseReplay();
      this.playReplay();
    }
  }

  floor(n: number) {
    return Math.floor(n);
  }
}
