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
import { catchError, Observable, Subscription, throwError } from 'rxjs';
import { Ref } from '../../model/ref';
import { ActionService } from '../../service/action.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';
import { printError } from '../../util/http';

@Component({
  standalone: false,
  selector: 'app-todo',
  templateUrl: './todo.component.html',
  styleUrls: ['./todo.component.scss'],
  host: {'class': 'todo-list'}
})
export class TodoComponent implements OnChanges {

  @Input()
  ref?: Ref;
  @Input()
  text? = '';
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

  private watch?: Subscription;
  private comment$!: (comment: string) => Observable<string>;

  constructor(
    public config: ConfigService,
    private store: Store,
    private actions: ActionService,
    private zone: NgZone,
  ) {
    if (config.mobile) {
      this.pressToUnlock = true;
    }
  }

  init() {
    this.lines = (this.ref?.comment || this.text || '').split('\n')?.filter(l => !!l) || [];
    if (!this.watch && this.ref) {
      const watch = this.actions.watch(this.ref);
      this.comment$ = watch.comment$;
      this.watch = watch.ref$.subscribe(update => {
        this.ref!.comment = update.comment;
        this.init();
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
    this.comment$(comment).pipe(
      catchError(err => {
        if (err?.conflict) {
          // TODO: see if conflict can be auto resolved
        } else {
          this.serverErrors = printError(err);
        }
        return throwError(() => err);
      })
    ).subscribe(cursor => {
      if (!this.local) {
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
