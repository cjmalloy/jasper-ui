import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
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
import { ReactiveFormsModule } from '@angular/forms';
import { catchError, Observable, of, Subscription, switchMap, throwError, timer } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../../model/ref';
import { ActionService } from '../../service/action.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';
import { TodoItemComponent } from './item/item.component';

@Component({
  selector: 'app-todo',
  templateUrl: './todo.component.html',
  styleUrls: ['./todo.component.scss'],
  host: { 'class': 'todo-list' },
  imports: [CdkDropList, TodoItemComponent, CdkDrag, ReactiveFormsModule]
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
  addText = '';
  pushText: string[] = [];
  pressToUnlock = false;
  serverErrors: string[] = [];

  private watch?: Subscription;
  private pushing?: Subscription;
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
    this.save$(this.lines.join('\n'))?.subscribe();
  }

  update(line: {index: number, text: string, checked: boolean}) {
    if (!line.text) {
      this.lines.splice(line.index, 1);
    } else {
      this.lines[line.index] = `- [${line.checked ? 'X' : ' '}] ${line.text}`;
    }
    this.save$(this.lines.join('\n'))?.subscribe();
  }

  save$(comment: string) {
    this.comment.emit(comment);
    if (!this.ref) return of();
    return this.comment$(comment).pipe(
      tap(() => {
        if (!this.local) {
          this.copied.emit(this.store.account.origin);
          this.store.eventBus.refresh(this.ref);
        }
      }),
    );
  }

  add(cancel?: Event) {
    cancel?.preventDefault();
    this.addText = this.addText.trim();
    if (!this.addText) return;
    this.pushText.push(`- [ ] ${this.addText}`);
    this.addText = '';
    if (!this.pushing) this.pushing = this.push$().subscribe();
  }

  push$(): Observable<string> {
    const lines = [...this.pushText];
    return this.save$([...this.lines, ...lines].join('\n')).pipe(
      catchError((err: any) => {
        if (err.conflict) {
          return timer(100).pipe(switchMap(() => this.push$()));
        }
        return throwError(() => err);
      }),
      tap(() => {
        this.pushText = this.pushText.slice(lines.length);
        delete this.pushing;
        if (this.pushText.length) this.pushing = this.push$().subscribe();
      }),
    );
  }
}
