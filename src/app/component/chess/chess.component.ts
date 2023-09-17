import { CdkDragDrop, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, ElementRef, HostBinding, Input, OnInit } from '@angular/core';
import { Chess, Square } from 'chess.js';
import { defer, flatten } from 'lodash-es';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'b' | 'w';

type Piece = { type: PieceType, color: PieceColor, square: Square, };

@Component({
  selector: 'app-chess',
  templateUrl: './chess.component.html',
  styleUrls: ['./chess.component.scss'],
  hostDirectives: [CdkDropListGroup]
})
export class ChessComponent implements OnInit {
  @HostBinding('class') css = 'chess-board';

  @Input()
  ref?: Ref;
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

  private resizeObserver = new ResizeObserver(() => this.onResize());
  private fen = '';

  constructor(
    private refs: RefService,
    private el: ElementRef<HTMLTextAreaElement>,
  ) {
    this.resizeObserver.observe(el.nativeElement);
  }

  ngOnInit(): void {
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

//   rnb1k3/pppp1p2/3bpq2/8/5P1r/4PQ1N/PPPP2P1/RNB1KB2 w Qq - 1 1
//
// +------------------------+
//   8 | r  n  b  .  k  .  .  . |
//   7 | p  p  p  p  .  p  .  . |
//   6 | .  .  .  b  p  q  .  . |
//   5 | .  .  .  .  .  .  .  . |
//   4 | .  .  .  .  .  P  .  r |
//   3 | .  .  .  .  P  Q  .  N |
//   2 | P  P  P  P  .  .  P  . |
//   1 | R  N  B  .  K  B  .  . |
// +------------------------+
//   a  b  c  d  e  f  g  h

  onResize() {
    this.dim = this.el.nativeElement.offsetWidth / 8;
    this.fontSize = 0.75 * this.el.nativeElement.offsetWidth / 8;
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
      const title = (this.ref.title || '').replace(/\|.*/, '') + ' | ' + move.san;
      const comment = this.fen + '\n\n' + this.chess.history().join('\n');
      this.refs.patch(this.ref.url, this.ref.origin!, [{
        op: 'add',
        path: '/title',
        value: title,
      }, {
        op: 'add',
        path: '/comment',
        value: comment,
      }]).subscribe(() => {
        this.ref!.title = title;
        this.ref!.comment = comment;
      });
    }
    delete this.from;
    delete this.to;
    this.moves = this.chess.moves({ verbose: true }).map(m => m.to);
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
}
