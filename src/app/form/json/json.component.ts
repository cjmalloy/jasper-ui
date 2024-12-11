import { Component, HostBinding, Input, OnDestroy } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { autorun, IReactionDisposer } from 'mobx';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  standalone: false,
  selector: 'app-json',
  templateUrl: './json.component.html',
  styleUrls: ['./json.component.scss']
})
export class JsonComponent implements OnDestroy {
  @HostBinding('class') css = 'json-editor';

  private disposers: IReactionDisposer[] = [];

  @Input()
  group!: UntypedFormGroup;
  @Input()
  fieldName = 'source';

  options: any = {
    language: 'json',
    automaticLayout: true,
  };

  constructor(
    public config: ConfigService,
    private store: Store,
  ) {
    this.disposers.push(autorun(() => {
      this.options = {
        ...this.options,
        theme: store.darkTheme ? 'vs-dark' : 'vs',
      }
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
