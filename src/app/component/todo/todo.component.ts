import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { computed,
  Component,
  effect,
  ChangeDetectionStrategy,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { catchError, Observable, of, startWith, Subscription, switchMap, throwError, timer } from 'rxjs';
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
    '[class.empty]': "empty()",
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

  private readonly watcher = computed(() => this.ref() ? this.actions.watch(this.ref()!) : undefined);
  private readonly watchedRef = toSignal(toObservable(this.watcher).pipe(
    switchMap(watch => watch ? watch.ref$.pipe(startWith(this.ref())) : of(undefined)),
  ), { initialValue: undefined });
  readonly lines = linkedSignal(() => (this.watchedRef()
    ? this.watchedRef()?.comment || ''
    : this.ref()?.comment || this.text() || '').split('\n').filter(l => !!l));
  readonly addText = linkedSignal(() => { this.ref(); this.text(); return ''; });
  readonly pushText = linkedSignal<string[]>(() => { this.ref(); return []; });
  readonly pressToUnlock = linkedSignal(() => this.config.mobile);
  readonly serverErrors = linkedSignal<string[]>(() => { this.ref(); return []; });

  private pushing?: Subscription;

  constructor(
    public config: ConfigService,
    private store: Store,
    private actions: ActionService,
  ) {
    effect(onCleanup => {
      this.ref();
      onCleanup(() => {
        this.pushing?.unsubscribe();
        this.pushing = undefined;
      });
    });
  }

  touchstart(e: TouchEvent) {
    this.pressToUnlock.set(true);
  }

  readonly empty = computed(() => {
    return !this.lines().length;
  });

  readonly local = computed(() => {
    return this.ref()?.origin === this.store.account.origin();
  });

  drop(event: CdkDragDrop<string, string, string>) {
    const lines = [...this.lines()];
    if (event.previousContainer.data === event.container.data) {
        lines.splice(event.previousIndex, 1);
    } else {
      // TODO: Delete from prev
    }
    lines.splice(event.currentIndex, 0, event.item.data);
    this.lines.set(lines);
    this.save$(this.lines().join('\n'))?.subscribe();
  }

  update(line: {index: number, text: string, checked: boolean}) {
    const lines = [...this.lines()];
    if (!line.text) {
      lines.splice(line.index, 1);
    } else {
      lines[line.index] = `- [${line.checked ? 'X' : ' '}] ${line.text}`;
    }
    this.lines.set(lines);
    this.save$(this.lines().join('\n'))?.subscribe();
  }

  save$(comment: string) {
    this.comment.emit(comment);
    if (!this.ref()) return of();
    return this.watcher()!.comment$(comment).pipe(
      tap(() => {
        if (!this.local()) {
          this.copied.emit(this.store.account.origin());
          this.store.eventBus.refresh(this.ref());
        }
      }),
    );
  }

  add(cancel?: Event) {
    cancel?.preventDefault();
    this.addText.set(this.addText().trim());
    if (!this.addText()) return;
    const text = this.addText();
    this.pushText.update(lines => [...lines, `- [ ] ${text}`]);
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
        this.pushText.update(queued => queued.slice(lines.length));
        delete this.pushing;
        if (this.pushText().length) this.pushing = this.push$().subscribe();
      }),
    );
  }
}
