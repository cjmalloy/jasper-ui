import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import {
  Component,
  effect,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  untracked,
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
  host: {
    'class': 'todo-list',
    '[class.empty]': 'empty',
    '(touchstart)': 'touchstart($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CdkDropList,
    CdkDrag,
    ReactiveFormsModule,
    TodoItemComponent,
  ]
})
export class TodoComponent {

  readonly ref = input<Ref>();
  readonly text = input<string | undefined>('');
  readonly origin = input('');
  readonly tags = input<string[]>();
  readonly comment = output<string>();
  readonly copied = output<string>();

  readonly lines = signal<string[]>([]);
  readonly addText = signal('');
  readonly pushText = signal<string[]>([]);
  readonly pressToUnlock = signal(false);
  readonly serverErrors = signal<string[]>([]);






  private watch?: Subscription;
  private pushing?: Subscription;
  private comment$!: (comment: string) => Observable<string>;

  constructor(
    public config: ConfigService,
    private store: Store,
    private actions: ActionService,
  ) {
    if (config.mobile) {
      this.pressToUnlock.set(true);
    }
    effect(() => {
      this.ref();
      this.text();
      untracked(() => this.init());
    });
  }

  init() {
    this.lines.set((this.ref()?.comment || this.text() || '').split('\n')?.filter(l => !!l) || []);
    const ref = this.ref();
    if (!this.watch && ref) {
      const watch = this.actions.watch(ref);
      this.comment$ = watch.comment$;
      this.watch = watch.ref$.subscribe(update => {
        this.ref()!.comment = update.comment;
        this.init();
      });
    }
  }

  touchstart(e: TouchEvent) {
    this.pressToUnlock.set(true);
  }

  get empty() {
    return !this.lines().length;
  }

  get local() {
    return this.ref()?.origin === this.store.account.origin;
  }

  drop(event: CdkDragDrop<string, string, string>) {
    if (event.previousContainer.data === event.container.data) {
        this.lines().splice(event.previousIndex, 1);
    } else {
      // TODO: Delete from prev
    }
    this.lines().splice(event.currentIndex, 0, event.item.data);
    this.lines.set([...this.lines()]);
    this.save$(this.lines().join('\n'))?.subscribe();
  }

  update(line: {index: number, text: string, checked: boolean}) {
    if (!line.text) {
      this.lines().splice(line.index, 1);
    } else {
      this.lines()[line.index] = `- [${line.checked ? 'X' : ' '}] ${line.text}`;
    }
    this.lines.set([...this.lines()]);
    this.save$(this.lines().join('\n'))?.subscribe();
  }

  save$(comment: string) {
    this.comment.emit(comment);
    if (!this.ref()) return of();
    return this.comment$(comment).pipe(
      tap(() => {
        if (!this.local) {
          this.copied.emit(this.store.account.origin);
          this.store.eventBus.refresh(this.ref());
        }
      }),
    );
  }

  add(cancel?: Event) {
    cancel?.preventDefault();
    this.addText.set(this.addText().trim());
    if (!this.addText()) return;
    this.pushText.set([...this.pushText(), `- [ ] ${this.addText()}`]);
    this.addText.set('');
    if (!this.pushing) this.pushing = this.push$().subscribe();
  }

  push$(): Observable<string> {
    const lines = [...this.pushText()];
    return this.save$([...this.lines(), ...lines].join('\n')).pipe(
      catchError((err: any) => {
        if (err.conflict) {
          return timer(100).pipe(switchMap(() => this.push$()));
        }
        return throwError(() => err);
      }),
      tap(() => {
        this.pushText.set(this.pushText().slice(lines.length));
        delete this.pushing;
        if (this.pushText().length) this.pushing = this.push$().subscribe();
      }),
    );
  }
}
