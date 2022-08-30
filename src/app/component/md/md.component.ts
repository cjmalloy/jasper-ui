import { Component, Input, OnInit } from '@angular/core';
import * as _ from 'lodash-es';
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
  text = '';
  @Input()
  plugins? = ['plugin/emoji', 'plugin/latex'];

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

  get emoji() {
    return !!this.admin.status.plugins.emoji && !!this.plugins?.includes('plugin/emoji');
  }

  get latex() {
    return !!this.admin.status.plugins.latex && !!this.plugins?.includes('plugin/latex');
  }

  onReady = _.debounce(() => {
    this.postProcessMarkdown.next();
  }, 3000);

}
