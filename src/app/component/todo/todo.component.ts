import { CdkDragDrop } from '@angular/cdk/drag-drop';
import {
  Component,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import { DateTime } from 'luxon';
import { catchError, Observable, Subscription, throwError } from 'rxjs';
import { Ref, RefUpdates } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';
import { printError } from '../../util/http';

@Component({
  standalone: false,
  selector: 'app-todo',
  templateUrl: './todo.component.html',
  styleUrls: ['./todo.component.scss'],
})
export class TodoComponent implements OnChanges {
  @HostBinding('class') css = 'todo-list';

  @Input()
  ref?: Ref;
  @Input()
  text? = '';
  @Input()
  origin = '';
  @Input()
  tags?: string[];
  @Input()
  updates$?: Observable<RefUpdates>;
  @Output()
  comment = new EventEmitter<string>();
  @Output()
  copied = new EventEmitter<string>();

  lines: string[] = [];
  addText = ``;
  pressToUnlock = false;
  serverErrors: string[] = [];

  private watch?: Subscription;
  private cursor?: string;

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

  init() {
    this.lines = (this.ref?.comment || this.text || '').split('\n')?.filter(l => !!l) || [];
    if (this.local) {
      this.cursor ||= this.ref?.modifiedString;
    }
    if (!this.watch && this.updates$) {
      this.watch = this.updates$.subscribe(u => {
        this.ref!.comment = u.comment;
        if (u.origin === this.store.account.origin) {
          this.ref!.modified = u.modified;
          this.ref!.modifiedString = this.cursor = u.modifiedString;
          this.init();
        }
      });
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref || changes.text) {
      this.init();
    }
  }

  @HostListener('touchstart', ['$event'])
  touchstart(e: TouchEvent) {
    this.zone.run(() => this.pressToUnlock = true);
  }

  @HostBinding('class.empty')
  get empty() {
    return !this.lines.length;
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
    if (!line.text) {
      this.lines.splice(line.index, 1);
    } else {
      this.lines[line.index] = `- [${line.checked ? 'X' : ' '}] ${line.text}`;
    }
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
    ).subscribe(cursor => {
      if (!this.cursor) {
        this.ref!.origin = this.store.account.origin;
        this.copied.emit(this.store.account.origin);
      }
      this.ref!.comment = comment;
      this.ref!.modified = DateTime.fromISO(cursor);
      this.ref!.modifiedString = this.cursor = cursor;
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
