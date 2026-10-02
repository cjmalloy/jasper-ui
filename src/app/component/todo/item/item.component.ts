import {
  Component,
  ElementRef,
  forwardRef,
  HostBinding,
  HostListener,
  Input,
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
  host: { 'class': 'todo-item' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AutofocusDirective,
    forwardRef(() => MdComponent),
  ]
})
export class TodoItemComponent {

  @HostBinding('class.unlocked')
  get unlocked() { return this.unlockedSignal(); }
  private readonly unlockedSignal = signal(false);

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

  private _line = '';

  constructor(
    private store: Store,
    public config: ConfigService,
    private el: ElementRef,
  ) { }

  get local() {
    return this.origin() === this.store.account.origin;
  }

  @Input()
  set line(value: string) {
    this._line = value;
    if (value) {
      this.checked = !!/^[\s-]*\[([\sxX]*)]/.exec(value)?.[1]?.trim() || false;
      this.text = this._line.replace(/^[\s-]*\[[\sxX]*]\s*/g, '');
    } else {
      this.checked = false;
      this.text = '';
    }
  }

  @HostListener('touchend', ['$event'])
  touchend(e: TouchEvent) {
    this.unlockedSignal.set(false);
  }

  @HostListener('press', ['$event'])
  unlock(event: any) {
    if (!this.config.mobile) return;
    this.unlockedSignal.set(true);
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
