import { Component, Input, OnInit } from '@angular/core';
import { debounce } from 'lodash-es';
import { Subject } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-md',
  templateUrl: './md.component.html',
  styleUrls: ['./md.component.scss']
})
export class MdComponent implements OnInit {

  @Input()
  origin? = '';
  @Input()
  text? = '';
  @Input()
  plugins?: string[];

  postProcessMarkdown: Subject<void> = new Subject();

  katexOptions = {
    throwOnError: false,
    delimiters: [
      {left: "$$", right: "$$", display: true},
      {left: "$", right: "$", display: false},
    ],
  };

  constructor(
    public admin: AdminService,
    public store: Store,
  ) { }

  ngOnInit(): void {
  }

  onReady = debounce(() => {
    this.postProcessMarkdown.next();
  }, 3000);

}
