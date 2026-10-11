import {
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  linkedSignal,
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
  imports: [
    AutofocusDirective,
    forwardRef(() => MdComponent),
  ]
})
export class TodoItemComponent {
  private store = inject(Store);
  config = inject(ConfigService);
  private el = inject(ElementRef);


  readonly unlocked = signal(false);

  readonly pressToUnlock = input(false);
  readonly plugins = input<string[]>([]);
  readonly origin = input('');

  readonly update = output<{
    text: string;
    checked: boolean;
}>();

  readonly checked = linkedSignal(() => !!/^[\s-]*\[([\sxX]*)]/.exec(this.line())?.[1]?.trim());
  readonly editing = linkedSignal(() => { this.line(); return false; });
  readonly text = linkedSignal(() => this.line().replace(/^[\s-]*\[[\sxX]*]\s*/g, ''));
  readonly hovering = signal(false);

  readonly line = input('', { alias: 'line' });

  readonly local = computed(() => {
    return this.origin() === this.store.account.origin();
  });

  touchend(e: TouchEvent) {
    this.unlocked.set(false);
  }

  unlock(event: any) {
    if (!this.config.mobile()) return;
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
