import { CdkDragDrop, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, ElementRef, HostBinding, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { Chess, Square } from 'chess.js';
import { defer, delay, flatten, uniq } from 'lodash-es';
import { toJS } from 'mobx';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { StompService } from '../../service/api/stomp.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'b' | 'w';

type Piece = { type: PieceType, color: PieceColor, square: Square, };

@Component({
  selector: 'app-chess',
  templateUrl: './chess.component.html',
  styleUrls: ['./chess.component.scss'],
  hostDirectives: [CdkDropListGroup]
})
export class ChessComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'chess-board';
  private destroy$ = new Subject<void>();

  @Input()
  white = true;

  turn: PieceColor = 'w';
  from?: Square;
  to?: Square;
  moves: Square[] = [];
  chess = new Chess();
  pieces: (Piece | null)[] = [];
  dim = 32;
  fontSize = 32;
  writeAccess = false;
  bounce = '';

  private _ref?: Ref;
  private resizeObserver = new ResizeObserver(() => this.onResize());
  private fen = '';
  private watches: Subscription[] = [];
  /**
   * Flag to prevent animations for own moves.
   */
  private patchingComment = '';

  constructor(
    public config: ConfigService,
    private auth: AuthzService,
    private refs: RefService,
    private store: Store,
    private stomps: StompService,
    private el: ElementRef<HTMLTextAreaElement>,
  ) { }

  ngOnInit(): void {
    if (this.ref && this.config.websockets) {
      this.watches.forEach(w => w.unsubscribe());
      this.watches = [];
      this.refs.page({ url: this.ref.url, obsolete: true, size: 500, sort: ['modified,DESC']}).subscribe(page => {
        this.stomps.watchRef(this.ref!.url, uniq(page.content.map(r => r.origin))).forEach(w => this.watches.push(w.pipe(
          takeUntil(this.destroy$),
        ).subscribe(u => {
          const moves = (u.comment?.substring(this.patchingComment.length || this.ref?.comment?.length || 0) || '')
            .trim()
            .split(/\s+/g)
            .map(m => m.trim())
            .filter(m => !!m);
          if (!this.bounce && moves.length) {
            // TODO: queue all moves and animate one by one
            this.bounce = moves[moves.length-1].replace(/[^a-h1-8]/g, '');
            if (this.bounce.length > 2) this.bounce = this.bounce.substring(this.bounce.length - 2, this.bounce.length);
            delay(() => this.bounce = '', 3400);
          }
          this.ref!.title = u.title
          this.ref!.comment = u.comment
          this.ref!.modifiedString = u.modifiedString
          this.ref = this.ref;
          this.store.eventBus.refresh(this.ref);
        })));
      });
    }
    this.resizeObserver.observe(this.el.nativeElement);
    this.writeAccess = this.auth.writeAccess(this.ref!);
    this.onResize();
    this.chess.clear();
    try {
      if (this.ref?.comment) {
        const lines = this.ref.comment.trim().split('\n');
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
      this.chess.loadPgn(this.ref?.comment || '');
    }
    this.pieces = flatten(this.chess.board());
    this.turn = this.chess.turn();
    this.moves = this.chess.moves({ verbose: true }).map(m => m.to);
    console.log(this.chess.ascii());
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
    delete this.from;
    delete this.to;
    const newRef = this.ref?.url !== value?.url;
    this._ref = toJS(value);
    if (newRef) {
      this.ngOnInit();
    } else {
      // TODO: Animate
      this.ngOnInit();
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.dim = Math.floor(this.el.nativeElement.offsetWidth / 8);
    this.fontSize = Math.floor(0.75 * this.dim);
  }

  drawPiece(p?: Piece | null) {
    if (p?.color === 'w') {
      switch (p.type) {
        case 'k': return $localize`♔`;
        case 'q': return $localize`♕`;
        case 'r': return $localize`♖`;
        case 'b': return $localize`♗`;
        case 'n': return $localize`♘`;
        case 'p': return $localize`️️️️️️♙`;
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
    const move = this.chess.move({from, to, promotion: isPromotion ? window.prompt('Promotion:') as Exclude<PieceType, 'p' | 'k'> : undefined});
    if (move) {
      this.pieces = flatten(this.chess.board());
      this.turn = this.chess.turn();
      console.log(this.chess.ascii());
      if (this.chess.isGameOver()) {
        defer(() => {
          if (this.chess.isCheckmate()) {
            window.alert($localize`Checkmate!`);
          } else if (this.chess.isStalemate()) {
            window.alert($localize`Stalemate!`);
          } else if (this.chess.isThreefoldRepetition()) {
            window.alert($localize`Threefold Repetition!`);
          } else if (this.chess.isInsufficientMaterial()) {
            window.alert($localize`Insufficient Material!`);
          } else if (this.chess.isDraw()) {
            window.alert($localize`Draw!`);
          } else {
            window.alert($localize`Game Over!`);
          }
        });
      }

      if (!this.ref) return;
      const title = (this.ref.title || '').replace(/\s*\|.*/, '') + ' | ' + move.san;
      this.patchingComment = this.fen + '\n\n' + this.chess.history().join('  \n');
      this.refs.patch(this.ref.url, this.ref.origin!, [{
        op: 'add',
        path: '/title',
        value: title,
      }, {
        op: 'add',
        path: '/comment',
        value: this.patchingComment,
      }]).subscribe(() => {
        this.ref!.title = title;
        this.ref!.comment = this.patchingComment;
        this.patchingComment = '';
        this.store.eventBus.reload(this.ref);
      });
    }
    delete this.from;
    delete this.to;
    this.moves = this.chess.moves({ verbose: true }).map(m => m.to);
  }

  clickSquare(index: number) {
    if (!this.writeAccess) return;
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
}
