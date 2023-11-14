import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Component, EventEmitter, HostBinding, HostListener, Input, NgZone, Output } from '@angular/core';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';
import { printError } from '../../util/http';

@Component({
  selector: 'app-todo',
  templateUrl: './todo.component.html',
  styleUrls: ['./todo.component.scss'],
})
export class TodoComponent {
  @HostBinding('class') css = 'todo-list';

  @Input()
  origin = '';
  @Input()
  tags?: string[];
  @Output()
  comment = new EventEmitter<string>();
  @Output()
  copied = new EventEmitter<string>();

  lines: string[] = [];
  addText = ``;
  pressToUnlock = false;
  serverErrors: string[] = [];
  private _ref?: Ref;

  constructor(
    public config: ConfigService,
    private store: Store,
    private refs: RefService,
    private zone: NgZone,
  ) {
    if (config.mobile) {
      this.pressToUnlock = true;
    }
  }

  @HostListener('touchstart', ['$event'])
  touchstart(e: TouchEvent) {
    this.zone.run(() => this.pressToUnlock = true);
  }

  get ref() {
    return this._ref;
  }

  @Input()
  set ref(value: Ref | undefined) {
    this._ref = value;
    if (value) {
      this.lines = value.comment?.split('\n')?.filter(l => !!l) || [];
    }
  }

  get local() {
    return this.ref?.origin === this.store.account.origin;
  }

  drop(event: CdkDragDrop<string, string, string>) {
    if (event.previousContainer.data === event.container.data) {
      this.lines.splice(event.previousIndex, 1);
    } else {
      // TODO: Delete from prev
    }
    this.lines.splice(event.currentIndex, 0, event.item.data);
    this.save(this.lines.join('\n'));
  }

  update(line: {index: number, text: string, checked: boolean}) {
    this.lines[line.index] = `- [${line.checked ? 'X' : ' '}] ${line.text}`;
    this.save(this.lines.join('\n'));
  }

  save(comment: string) {
    this.comment.emit(comment);
    if (!this.ref) return;
    this.refs.merge(this.ref.url, this.store.account.origin, this.ref.modifiedString!,
      { comment }
    ).pipe(
      catchError(err => {
        this.serverErrors = printError(err);
        return throwError(() => err);
      })
    ).subscribe(modifiedString => {
      this.ref!.comment = comment;
      this.ref!.modified = moment(modifiedString);
      this.ref!.modifiedString = modifiedString;
      if (!this.local) {
        this.ref!.origin = this.store.account.origin;
        this.copied.emit(this.store.account.origin);
      }
      this.store.eventBus.refresh(this.ref);
    });
  }

  add(cancel?: Event) {
    cancel?.preventDefault();
    this.addText = this.addText.trim();
    if (!this.addText) return;
    this.lines.push(`- [ ] ${this.addText}`);
    this.save(this.lines.join('\n'));
    this.addText = '';
  }
}
