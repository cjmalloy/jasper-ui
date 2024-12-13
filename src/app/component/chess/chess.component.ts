import { CdkDragDrop, CdkDropListGroup } from '@angular/cdk/drag-drop';
import {
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
import { Chess, Move, Square } from 'chess.js';
import { defer, delay, flatten, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, Observable, Subscription, throwError } from 'rxjs';
import { Ref, RefUpdates } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'b' | 'w';

type Piece = { type: PieceType, color: PieceColor, square: Square, };

@Component({
  standalone: false,
  selector: 'app-chess',
  templateUrl: './chess.component.html',
  styleUrls: ['./chess.component.scss'],
  hostDirectives: [CdkDropListGroup]
})
export class ChessComponent implements OnInit, OnChanges, OnDestroy {
  @HostBinding('class') css = 'chess-board';
  private disposers: IReactionDisposer[] = [];

  @Input()
  ref?: Ref;
  @Input()
  text? = '';
  @Input()
  white = true; // TODO: Save in local storage
  @Input()
  updates$?: Observable<RefUpdates>;
  @Output()
  comment = new EventEmitter<string>();
  @Output()
  copied = new EventEmitter<string>();

  turn: PieceColor = 'w';
  from?: Square;
  to?: Square;
  moves: Square[] = [];
  chess = new Chess();
  pieces: (Piece | null)[] = flatten(this.chess.board());
  writeAccess = false;
  bounce: string[] = [];
  @HostBinding('class.flip')
  flip = false;

  private cursor?: string;
  private resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.onResize()) || undefined;
  private fen = '';
  private watch?: Subscription;
  /**
   * Flag to prevent animations for own moves.
   */
  private prevComment = '';
  /**
   * Queued animation.
   */
  private incoming?: Square;
  private board?: string;

  constructor(
    public config: ConfigService,
    private auth: AuthzService,
    private refs: RefService,
    private store: Store,
    private el: ElementRef<HTMLDivElement>,
  ) {
    this.disposers.push(autorun(() => {
      if (this.store.eventBus.event === 'flip' && this.store.eventBus.ref?.url === this.ref?.url) {
        this.flip = true;
        delay(() => {
          this.flip = false;
          this.white = !this.white;
        }, 1000);
        defer(() => this.store.eventBus.fire('flip-done'));
      }
    }));
  }

  ngOnInit(): void {
    this.resizeObserver?.observe(this.el.nativeElement);
    this.onResize();
  }

  init() {
    this.prevComment = this.ref?.comment || '';
    if (!this.watch && this.updates$) {
      this.watch = this.updates$.subscribe(u => {
        if (u.origin === this.store.account.origin) this.cursor = u.modifiedString;
        else this.ref!.modifiedString = u.modifiedString;
        const prev = this.prevComment
          .trim()
          .split(/\s+/g)
          .map(m => m.trim() as Square)
          .filter(m => !!m);
        const current = (u.comment || '')
          .trim()
          .split(/\s+/g)
          .map(m => m.trim() as Square)
          .filter(m => !!m);
        const minLen = Math.min(prev.length, current.length);
        for (let i = 0; i < minLen; i++) {
          if (prev[i] !== current[i] || i === minLen - 1) {
            prev.splice(0, i + 1);
            current.splice(0, i + 1);
            break;
          }
        }
        if (prev.length) {
          alert($localize`Game history was rewritten!`);
        }
        this.prevComment = u.comment || '';
        if (prev.length || !current.length) return;
        for (const m of current) this.chess.move(m);
        this.check();
        // TODO: queue all moves and animate one by one
        const move = current.shift()!;
        let lastMove = this.incoming = this.getMoveCoord(move, this.turn === 'w' ? 'b' : 'w');
        requestAnimationFrame(() => {
          if (lastMove != this.incoming) return;
          if (lastMove.length > 2) lastMove = lastMove.substring(lastMove.length - 2, lastMove.length) as Square;
          this.bounce.push(lastMove);
          delay(() => this.bounce = without(this.bounce, lastMove), 3400);
        });
      });
    }
    if (this.local) {
      this.writeAccess = !this.ref?.created || this.ref?.upload || this.auth.writeAccess(this.ref);
      this.cursor = this.ref?.modifiedString;
    } else {
      this.writeAccess = true;
      this.refs.get(this.ref!.url, this.store.account.origin).pipe(
        catchError(err => {
          if (err.status === 404) {
            delete this.cursor;
          }
          return throwError(() => err);
        })
      ).subscribe(ref => {
        this.cursor = ref.modifiedString;
        this.writeAccess = this.auth.writeAccess(ref)
      });
    }
    this.reset(this.ref?.comment || this.text);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref || changes.text) {
      const newRef = changes.ref?.firstChange || changes.ref?.previousValue?.url !== changes.ref?.currentValue?.url;
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

  reset(board?: string) {
    if (this.board === board) return;
    this.board = board;
    this.chess.clear();
    try {
      if (board) {
        const lines = board.trim().split('\n');
        this.chess.load(lines[0]);
        this.fen = this.chess.fen();
        lines.shift();
        for (const l of lines) {
          if (!l.trim()) continue;
          console.log(this.chess.ascii());
          try {
            this.chess.move(l);
          } catch (e) {
            console.log(e);
          }
        }
      } else {
        this.chess.loadPgn('');
      }
    } catch (e) {
      try {
        this.chess.loadPgn(board || '');
      } catch (e) {
        console.error(e);
      }
    }
    this.pieces = flatten(this.chess.board());
    this.turn = this.chess.turn();
    this.moves = this.chess.moves({ verbose: true }).map(m => m.to);
    console.log(this.chess.ascii());
  }

  get local() {
    return !this.ref?.created || this.ref.upload || this.ref?.origin === this.store.account.origin;
  }

  @HostListener('window:resize')
  onResize() {
    const dim = Math.floor(this.el.nativeElement.offsetWidth / 8);
    const fontSize = Math.floor(0.75 * dim);
    this.el.nativeElement.style.setProperty('--dim', dim + 'px');
    this.el.nativeElement.style.setProperty('--piece-size', fontSize + 'px');
  }

  setPieceSize() {
    const dim = Math.floor(this.el.nativeElement.offsetWidth / 8);
    const fontSize = Math.floor(0.75 * dim);
    document.body.style.setProperty('--drag-piece-size', fontSize + 'px');
  }

  drawPiece(p?: Piece | null) {
    if (p?.color === 'w') {
      switch (p.type) {
        case 'k': return $localize`♔`;
        case 'q': return $localize`♕`;
        case 'r': return $localize`♖`;
        case 'b': return $localize`♗`;
        case 'n': return $localize`♘`;
        case 'p': return $localize`♙`;
      }
    } else if (p?.color === 'b') {
      switch (p.type) {
        case 'k': return $localize`♚`;
        case 'q': return $localize`♛`;
        case 'r': return $localize`♜`;
        case 'b': return $localize`♝`;
        case 'n': return $localize`♞`;
        case 'p': return $localize`♟︎`;
      }
    }
    return ' ';
  }

  getIndex(place: string) {
    const col = place[0].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 9 - parseInt(place[1]);
    return row * 8 + col;
  }

  getCoord(index: number): Square {
    const col = index % 8;
    const row = 8 - Math.floor(index / 8);
    return String.fromCharCode('a'.charCodeAt(0) + col) + row as Square;
  }

  color(index: number) {
    const col = (index % 8) % 2;
    const row = Math.floor(index / 8) % 2;
    return col === row ?  'light' : 'dark';
  }

  drop(event: CdkDragDrop<number, number, Piece>) {
    const from = this.getCoord(event.previousContainer.data);
    const to = this.getCoord(event.container.data);
    if (from === to) return;
    this.move(from, to);
  }

  move(from: Square, to: Square) {
    if (from === to) return;
    const isPromotion = !!this.chess.moves({ verbose: true }).find((move) => move.from === from && move.to === to && move.flags.includes('p'));
    const move = this.chess.move({from, to, promotion: isPromotion ? confirm($localize`Promote to Queen:`) ? 'q' : prompt($localize`Promotion:`) as Exclude<PieceType, 'p' | 'k'> : undefined});
    if (move) {
      this.check();
      this.save(move!);
    }
  }

  check() {
    this.pieces = flatten(this.chess.board());
    this.turn = this.chess.turn();
    console.log(this.chess.ascii());
    if (this.chess.isGameOver()) {
      defer(() => {
        if (this.chess.isCheckmate()) {
          alert($localize`Checkmate!`);
        } else if (this.chess.isStalemate()) {
          alert($localize`Stalemate!`);
        } else if (this.chess.isThreefoldRepetition()) {
          alert($localize`Threefold Repetition!`);
        } else if (this.chess.isInsufficientMaterial()) {
          alert($localize`Insufficient Material!`);
        } else if (this.chess.isDraw()) {
          alert($localize`Draw!`);
        } else {
          alert($localize`Game Over!`);
        }
      });
    }
    delete this.from;
    delete this.to;
    this.moves = this.chess.moves({ verbose: true }).map(m => m.to);
  }

  save(move?: Move) {
    const comment = this.prevComment = (this.fen ? this.fen + '\n\n' : '') + this.chess.history().join('  \n');
    this.comment.emit(comment)
    if (!this.ref) return;
    const title = move && this.ref.title ? (this.ref.title || '').replace(/\s*\|.*/, '')  + ' | ' + move.san : '';
    (this.cursor ? this.refs.merge(this.ref.url, this.store.account.origin, this.cursor,
      { title, comment }
    ).pipe(
      catchError(err => {
        window.alert('Error syncing game. Please reload.');
        return throwError(() => err);
      })
    ) : this.refs.create({
      ...this.ref,
      origin: this.store.account.origin,
      title,
      comment,
    })).subscribe(cursor => {
      this.writeAccess = true;
      if (this.prevComment !== comment) return;
      this.ref!.title = title;
      this.ref!.comment = comment;
      this.ref!.modified = DateTime.fromISO(cursor);
      this.ref!.modifiedString = cursor;
      if (!this.local) {
        this.ref!.origin = this.store.account.origin;
        this.copied.emit(this.store.account.origin)
      }
      this.store.eventBus.refresh(this.ref);
    });
  }

  clickSquare(index: number) {
    const square = this.getCoord(index);
    const p = this.chess.get(square);
    if (this.from === square) {
      delete this.from;
      this.moves = this.chess.moves({ verbose: true }).map(m => m.to);
    } else if (this.turn === p?.color) {
      this.from = square;
      this.moves = this.chess.moves({ square, verbose: true }).map(m => m.to);
    } else if (this.from) {
      this.to = square;
      this.move(this.from, square);
    }
  }

  private getMoveCoord(move: string, turn: PieceColor): Square {
    if (move === 'O-O') {
      return turn === 'w' ? 'g1' : 'g8';
    } else if (move === 'O-O-O') {
      return turn === 'w' ? 'c1' : 'c8';
    } else {
      return move.replace(/[^a-h1-8]/g, '') as Square;
    }
  }
}
