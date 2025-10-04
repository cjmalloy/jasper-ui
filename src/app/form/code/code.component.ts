import { 
  ChangeDetectionStrategy,
  Component, Input, OnDestroy } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { autorun, IReactionDisposer } from 'mobx';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
  selector: 'app-code',
  templateUrl: './code.component.html',
  styleUrls: ['./code.component.scss']
})
export class CodeComponent implements OnDestroy {

  private disposers: IReactionDisposer[] = [];

  @Input()
  group!: UntypedFormGroup;
  @Input()
  fieldName = 'source';

  options: any = {
    language: 'css',
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

  @Input()
  set language(value: string) {
    this.options = {
      ...this.options,
      language: value,
    }
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
