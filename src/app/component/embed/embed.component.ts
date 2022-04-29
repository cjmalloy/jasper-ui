import { Component, Input, OnInit } from '@angular/core';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';

@Component({
  selector: 'app-embed',
  templateUrl: './embed.component.html',
  styleUrls: ['./embed.component.scss']
})
export class EmbedComponent implements OnInit {

  @Input()
  ref!: Ref;
  @Input()
  expandPlugins: string[] = [];

  constructor(
    public admin: AdminService,
  ) { }

  ngOnInit(): void {
  }

  get emoji() {
    return !!this.admin.status.plugins.emoji && !!this.ref.tags?.includes('plugin/emoji');
  }

  get latex() {
    return !!this.admin.status.plugins.latex && !!this.ref.tags?.includes('plugin/latex');
  }

}
