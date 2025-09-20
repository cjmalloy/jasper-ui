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
import { Observable, Subscription } from 'rxjs';
import { Ref, RefUpdates } from '../../model/ref';
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
  @HostBinding('class.flip')
  flip = false;

  private resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.onResize()) || undefined;
  private fen = '';
  private watch?: Subscription;
  /**
   * Last seen comment for conflict detection
   */
  private lastSeenComment = '';
  /**
   * Last edited comment for conflict detection  
   */
  private lastEditedComment = '';
  /**
   * Queued animation.
   */
  private incoming?: Square;
  private board?: string;

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
    this.lastSeenComment = this.ref?.comment || '';
    this.lastEditedComment = this.ref?.comment || '';
    this.writeAccess = true; // ActionService will handle the complexity
    
    if (this.ref) {
      this.watch = this.actions.watch$(this.ref).subscribe(update => {
        // Merge the update into our ref
        Object.assign(this.ref!, update);
        
        const currentComment = this.ref!.comment || '';
        
        // Simple version comparison - no need to know about origins
        const hasConflict = this.detectGameConflict(this.lastSeenComment, this.lastEditedComment, currentComment);
        
        if (hasConflict) {
          alert($localize`Game history was rewritten!`);
        } else {
          this.animateNewMoves(this.lastSeenComment, currentComment);
        }
        
        this.lastSeenComment = currentComment;
        // Track our own edits vs remote updates
        if (update.origin === this.store.account.origin) {
          this.lastEditedComment = currentComment;
        }
      });
    }
    
    this.reset(this.ref?.comment || this.text);
  }
  
  private detectGameConflict(lastSeen: string, lastEdited: string, current: string): boolean {
    const lastSeenMoves = this.parseMovesFromComment(lastSeen);
    const lastEditedMoves = this.parseMovesFromComment(lastEdited);
    const currentMoves = this.parseMovesFromComment(current);
    
    // Check if game history was rewritten
    const minLen = Math.min(lastSeenMoves.length, currentMoves.length);
    for (let i = 0; i < minLen; i++) {
      if (lastSeenMoves[i] !== currentMoves[i]) {
        return true; // History was rewritten
      }
    }
    
    return false;
  }
  
  private parseMovesFromComment(comment: string): Square[] {
    return comment
      .trim()
      .split(/\s+/g)
      .map(m => m.trim() as Square)
      .filter(m => !!m);
  }
  
  private animateNewMoves(prevComment: string, currentComment: string) {
    const prevMoves = this.parseMovesFromComment(prevComment);
    const currentMoves = this.parseMovesFromComment(currentComment);
    
    if (currentMoves.length <= prevMoves.length) return;
    
    // Get new moves
    const newMoves = currentMoves.slice(prevMoves.length);
    
    // Apply moves to chess engine
    for (const move of newMoves) {
      this.chess.move(move);
    }
    this.check();
    
    // Animate the last move
    if (newMoves.length > 0) {
      const lastMove = newMoves[newMoves.length - 1];
      let moveCoord = this.incoming = this.getMoveCoord(lastMove, this.turn === 'w' ? 'b' : 'w');
      requestAnimationFrame(() => {
        if (moveCoord != this.incoming) return;
        if (moveCoord.length > 2) moveCoord = moveCoord.substring(moveCoord.length - 2, moveCoord.length) as Square;
        this.bounce.push(moveCoord);
        delay(() => this.bounce = without(this.bounce, moveCoord), 3400);
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
    // Not needed anymore since ActionService handles this
    return true;
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
    const comment = (this.fen ? this.fen + '\n\n' : '') + this.chess.history().join('  \n');
    this.lastEditedComment = comment;
    this.comment.emit(comment);
    
    if (!this.ref) return;
    
    const title = move && this.ref.title ? (this.ref.title || '').replace(/\s*\|.*/, '')  + ' | ' + move.san : '';
    
    // Use the updated $comment method which handles origin management
    this.actions.$comment(comment, this.ref).subscribe({
      next: (cursor) => {
        if (title && this.ref!.title !== title) {
          this.ref!.title = title;
        }
        if (!this.local) {
          this.copied.emit(this.store.account.origin);
        }
        this.store.eventBus.refresh(this.ref);
      },
      error: (err) => {
        window.alert('Error syncing game. Please reload.');
        console.error(err);
      }
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
