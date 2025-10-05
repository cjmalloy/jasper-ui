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
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, Observable, of, Subscription, throwError } from 'rxjs';
import { Ref } from '../../model/ref';
import { ActionService } from '../../service/action.service';
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
  hostDirectives: [CdkDropListGroup],
  host: {'class': 'chess-board'}
})
export class ChessComponent implements OnInit, OnChanges, OnDestroy {
  private disposers: IReactionDisposer[] = [];

  @Input()
  ref?: Ref;
  @Input()
  text? = '';
  @Input()
  white = true; // TODO: Save in local storage
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
  translate: string[] = [];
  lastMoveTo?: Square;
  animating = false;
  animationQueue: { from: Square; to: Square; capture?: { square: Square; piece: Piece }; piece?: Piece }[] = [];
  movingPiece?: { piece: Piece; from: Square; to: Square };
  capturedPiece?: { piece: Piece; square: Square };
  @HostBinding('class.flip')
  flip = false;

  private resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.onResize()) || undefined;
  private fen = '';
  private watch?: Subscription;
  private append$!: (value: string) => Observable<string>;
  private board?: string;
  private incoming?: Square;
  private retry: string[] = [];

  constructor(
    public config: ConfigService,
    private actions: ActionService,
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
    this.reset(this.ref?.comment || this.text);
    if (!this.watch && this.ref) {
      const watch = this.actions.append(this.ref);
      this.append$ = watch.append$;
      this.watch = watch.updates$.pipe(
        catchError(err => {
          if (err.url) {
            // Game history rewritten
            alert($localize`Game History Rewritten!\n\nPlease Reload.`);
          }
          return of();
        }),
      ).subscribe(move => {
        try {
          this.chess.move(move);
          this.check();
          if (this.retry.length) {
            if (this.retry[0] === move) {
              // TODO: also check move number?
              this.retry.shift();
              return;
            } else {
              this.retrySave();
            }
          }
          // Parse the move to get from and to coordinates
          const moveObj = this.chess.history({ verbose: true }).pop();
          if (moveObj) {
            const capturedPieceInfo = moveObj.captured ? {
              square: moveObj.to,
              piece: { type: moveObj.captured, color: moveObj.color === 'w' ? 'b' : 'w', square: moveObj.to } as Piece
            } : undefined;
            this.queueAnimation(moveObj.from, moveObj.to, capturedPieceInfo, { type: moveObj.piece, color: moveObj.color, square: moveObj.to });
          }
        } catch (e) {
          this.clearErrors();
        }
      });
    }
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
    this.watch?.unsubscribe();
  }

  clearErrors() {
    if (this.ref) {
      this.actions.comment(this.history, this.ref!);
    } else {
      this.text = this.history;
    }
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

    // Highlight the last move on load
    const lastMove = this.chess.history({ verbose: true }).pop();
    if (lastMove) {
      this.lastMoveTo = lastMove.to;
    }

    if (!this.ref || (this.ref.comment || '') !== this.history) {
      this.clearErrors();
    }
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
      const capturedPieceInfo = move.captured ? {
        square: to,
        piece: { type: move.captured, color: move.color === 'w' ? 'b' : 'w', square: to } as Piece
      } : undefined;
      this.queueAnimation(from, to, capturedPieceInfo, { type: move.piece, color: move.color, square: to });
      this.check();
      this.save(move.san);
    }
  }

  check() {
    this.pieces = flatten(this.chess.board());
    this.turn = this.chess.turn();
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

  get history() {
    return (this.fen ? this.fen + '\n\n' : '') + this.chess.history().join('  \n');
  }

  save(move: string) {
    this.comment.emit(this.history);
    this.append$(move).pipe(
      catchError(err => {
        this.retry.push(move);
        delay(() => {
          if (this.retry.length) {
            this.clearErrors();
          }
        }, 1000);
        return throwError(() => err);
      }),
    ).subscribe();
  }

  retrySave() {
    if (!this.retry.length) return;
    const move = this.retry.shift()!;
    this.append$(move).pipe(
      catchError(err => {
        this.retry.unshift(move);
        return throwError(() => err);
      }),
    ).subscribe();
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

  queueAnimation(from: Square, to: Square, capture?: { square: Square; piece: Piece }, piece?: Piece) {
    this.animationQueue.push({ from, to, capture, piece });
    if (!this.animating) {
      this.processAnimationQueue();
    }
  }

  processAnimationQueue() {
    if (this.animationQueue.length === 0) {
      this.animating = false;
      delete this.movingPiece;
      delete this.capturedPiece;
      return;
    }

    this.animating = true;
    const animation = this.animationQueue.shift()!;
    
    // Set last move highlight - only highlight destination square
    this.lastMoveTo = animation.to;

    // Set up moving piece animation if we have piece data
    if (animation.piece) {
      this.movingPiece = { piece: animation.piece, from: animation.from, to: animation.to };
    }

    // If there's a capture, show the captured piece animation
    if (animation.capture) {
      this.capturedPiece = animation.capture;
    }

    // Calculate coordinates for CSS animation
    const fromIndex = this.getIndex(animation.from);
    const toIndex = this.getIndex(animation.to);
    const fromCol = fromIndex % 8;
    const fromRow = Math.floor(fromIndex / 8);
    const toCol = toIndex % 8;
    const toRow = Math.floor(toIndex / 8);
    
    // Calculate deltas - the piece at destination needs to animate FROM source position
    // So we need the negative offset from destination back to source
    const xFrom = this.white ? -(toCol - fromCol) : -(fromCol - toCol);
    const yFrom = this.white ? -(toRow - fromRow) : -(fromRow - toRow);
    const xTo = 0;
    const yTo = 0;

    // Set CSS variables on the host element
    this.el.nativeElement.style.setProperty('--xFrom', xFrom.toString());
    this.el.nativeElement.style.setProperty('--yFrom', yFrom.toString());
    this.el.nativeElement.style.setProperty('--xTo', xTo.toString());
    this.el.nativeElement.style.setProperty('--yTo', yTo.toString());

    // Animate the piece moving to its destination with translation
    const movingPiece = animation.to;
    this.translate.push(movingPiece);
    
    // Remove captured piece animation slightly before main animation completes
    // to prevent flash at the end
    if (animation.capture) {
      delay(() => {
        delete this.capturedPiece;
      }, 1500);
    }
    
    // Remove animation after completion
    delay(() => {
      this.translate = without(this.translate, movingPiece);
      delete this.movingPiece;
      // capturedPiece already deleted above if it existed
      if (!animation.capture) {
        delete this.capturedPiece;
      }
      // Process next animation after current one completes
      this.processAnimationQueue();
    }, 1600);
  }
}
