import { AfterViewInit, Component, ElementRef, HostBinding, Input, OnInit, ViewChild } from "@angular/core";
import { Subject } from "rxjs";
import { Ref } from "../../model/ref";
import { AccountService } from "../../service/account.service";
import { RefService } from "../../service/api/ref.service";

@Component({
  selector: 'app-comment-edit',
  templateUrl: './comment-edit.component.html',
  styleUrls: ['./comment-edit.component.scss']
})
export class CommentEditComponent implements OnInit, AfterViewInit {
  @HostBinding('class') css = 'comment-edit';

  editValue = '';

  @Input()
  ref!: Ref;
  @Input()
  commentEdited$!: Subject<void>;
  @ViewChild('textbox')
  textbox!: ElementRef;

  constructor(
    private account: AccountService,
    private refs: RefService,
  ) { }

  ngOnInit(): void {
    this.editValue = this.ref.comment || '';
  }

  ngAfterViewInit(): void {
    this.textbox.nativeElement.focus();
  }

  save() {
    this.refs.patch(this.ref.url, this.ref.origin!, [{
      op: 'add',
      path: '/comment',
      value: this.editValue,
    }]).subscribe(() => {
      this.ref.comment = this.editValue;
      this.commentEdited$.next();
    });
  }

  cancel() {
    this.commentEdited$.next();
  }
}
