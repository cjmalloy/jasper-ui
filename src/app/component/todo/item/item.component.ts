import {
  Component,
  ElementRef,
  forwardRef,
  HostBinding,
  HostListener,
  Input,
  NgZone,
  ChangeDetectionStrategy,
  input,
  output
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
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    AutofocusDirective,
    forwardRef(() => MdComponent),
  ]
})
export class TodoItemComponent {

  @HostBinding('class.unlocked')
  unlocked = false;

  readonly pressToUnlock = input(false);
  readonly plugins = input<string[]>([]);
  readonly origin = input('');

  readonly update = output<{
    text: string;
    checked: boolean;
}>();

  checked = false;
  editing = false;
  text = '';
  hovering = false;

  private _line = '';

  constructor(
    private store: Store,
    public config: ConfigService,
    private el: ElementRef,
    private zone: NgZone,
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
    this.zone.run(() => this.unlocked = false);
  }

  @HostListener('press', ['$event'])
  unlock(event: any) {
    if (!this.config.mobile) return;
    this.unlocked = true;
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
