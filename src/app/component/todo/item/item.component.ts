import {
  Component,
  ElementRef,
  effect,
  forwardRef,
  ChangeDetectionStrategy,
  input,
  output,
  signal
} from '@angular/core';
import { AutofocusDirective } from '../../../directive/autofocus.directive';
import { ConfigService } from '../../../service/config.service';
import { Store } from '../../../store/store';
import { MdComponent } from '../../md/md.component';

@Component({
  selector: 'app-todo-item',
  templateUrl: './item.component.html',
  styleUrls: ['./item.component.scss'],
  host: {
    'class': 'todo-item',
    '[class.unlocked]': 'unlocked()',
    '(touchend)': 'touchend($event)',
    '(press)': 'unlock($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AutofocusDirective,
    forwardRef(() => MdComponent),
  ]
})
export class TodoItemComponent {

  readonly unlocked = signal(false);

  readonly pressToUnlock = input(false);
  readonly plugins = input<string[]>([]);
  readonly origin = input('');

  readonly update = output<{
    text: string;
    checked: boolean;
}>();

  private readonly checkedSignal = signal(false);
  private readonly editingSignal = signal(false);
  private readonly textSignal = signal('');
  private readonly hoveringSignal = signal(false);

  get checked() { return this.checkedSignal(); }
  set checked(value: boolean) { this.checkedSignal.set(value); }

  get editing() { return this.editingSignal(); }
  set editing(value: boolean) { this.editingSignal.set(value); }

  get text() { return this.textSignal(); }
  set text(value: string) { this.textSignal.set(value); }

  get hovering() { return this.hoveringSignal(); }
  set hovering(value: boolean) { this.hoveringSignal.set(value); }

  readonly line = input('', { alias: 'line' });

  constructor(
    private store: Store,
    public config: ConfigService,
    private el: ElementRef,
  ) {
    effect(() => this.setLine(this.line()));
  }

  get local() {
    return this.origin() === this.store.account.origin;
  }

  private setLine(value: string) {
    if (value) {
      this.checked = !!/^[\s-]*\[([\sxX]*)]/.exec(value)?.[1]?.trim() || false;
      this.text = value.replace(/^[\s-]*\[[\sxX]*]\s*/g, '');
    } else {
      this.checked = false;
      this.text = '';
    }
  }

  touchend(e: TouchEvent) {
    this.unlocked.set(false);
  }

  unlock(event: any) {
    if (!this.config.mobile) return;
    this.unlocked.set(true);
    this.el.nativeElement.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    if ('vibrate' in navigator) navigator.vibrate([2, 32, 4]);
  }

  toggle() {
    this.checked = !this.checked;
    this.update.emit({ text: this.text, checked: this.checked });
  }

  edit() {
    this.update.emit({ text: this.text, checked: this.checked });
    this.editing = false;
  }
}
