import { AfterViewInit, Component, ElementRef, HostBinding, Input, ViewChild } from "@angular/core";
import { v4 as uuid } from "uuid";
import * as moment from "moment";
import { mergeMap, Subject } from "rxjs";
import { RefService } from "../../service/ref.service";
import { AccountService } from "../../service/account.service";
import { Ref } from "../../model/ref";

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss']
})
export class EditorComponent implements AfterViewInit {
  @HostBinding('class') css = 'editor';

  @Input()
  sources!: string[];
  @Input()
  tags: string[] = [];
  @Input()
  newComments!: Subject<Ref>;
  @ViewChild('textbox')
  textbox!: ElementRef;

  constructor(
    private account: AccountService,
    private refs: RefService,
  ) { }

  ngAfterViewInit(): void {
    this.textbox.nativeElement.focus();
  }

  reply(value: string) {
    if (!value) return;
    const url = 'comment://' + uuid();
    this.refs.create({
      url,
      sources: this.sources,
      comment: value,
      tags: ["public", "plugin/comment", this.account.tag, ...this.tags],
      published: moment(),
    }).pipe(
      mergeMap(() => this.refs.get(url))
    ).subscribe(ref => {
      this.newComments.next(ref);
      this.textbox.nativeElement.value = '';
    });
  }

}
