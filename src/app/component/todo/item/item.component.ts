import { Overlay } from '@angular/cdk/overlay';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnInit,
  Output,
  ViewContainerRef
} from '@angular/core';
import { defer } from 'lodash-es';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { AuthzService } from '../../../service/authz.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { ConfigService } from '../../../service/config.service';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-todo-item',
  templateUrl: './item.component.html',
  styleUrls: ['./item.component.scss']
})
export class TodoItemComponent implements OnInit {
  @HostBinding('class') css = 'todo-item';

  @HostBinding('class.unlocked')
  unlocked = false;

  @Input()
  pressToUnlock = false;
  @Input()
  plugins: string[] = [];
  @Input()
  origin = '';

  @Output()
  update = new EventEmitter<{ text: string, checked: boolean }>();

  checked = false;
  text = '';

  private _line = '';

  constructor(
    private store: Store,
    private config: ConfigService,
    private el: ElementRef,
  ) { }

  get local() {
    return this.origin === this.store.account.origin;
  }

  ngOnInit(): void {
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
    this.unlocked = false;
  }

  @HostListener('press', ['$event'])
  unlock(event: any) {
    if (!this.config.mobile) return;
    this.unlocked = true;
    this.el.nativeElement.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    if ('vibrate' in navigator) defer(() => navigator.vibrate([2, 32, 2]));
  }

  toggle() {
    this.checked = !this.checked;
    this.update.next({ text: this.text, checked: this.checked });
  }
}