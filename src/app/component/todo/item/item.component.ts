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

  readonly checked = signal(false);
  readonly editing = signal(false);
  readonly text = signal('');
  readonly hovering = signal(false);





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
      this.checked.set(!!/^[\s-]*\[([\sxX]*)]/.exec(value)?.[1]?.trim() || false);
      this.text.set(value.replace(/^[\s-]*\[[\sxX]*]\s*/g, ''));
    } else {
      this.checked.set(false);
      this.text.set('');
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
    this.checked.set(!this.checked());
    this.update.emit({ text: this.text(), checked: this.checked() });
  }

  edit() {
    this.update.emit({ text: this.text(), checked: this.checked() });
    this.editing.set(false);
  }
}
