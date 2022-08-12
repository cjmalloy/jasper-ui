import { Component, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-ref-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.scss'],
})
export class RefGraphComponent implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];

  constructor(
    private theme: ThemeService,
    public store: Store,
  ) { }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.theme.setTitle('Graph: ' + (this.store.view.ref?.title || this.store.view.url));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
