import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { autorun, IReactionDisposer } from 'mobx';
import { Store } from '../../store/store';

@Component({
  selector: 'app-code',
  templateUrl: './code.component.html',
  styleUrls: ['./code.component.scss']
})
export class CodeComponent implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];

  @Input()
  group!: UntypedFormGroup;
  @Input()
  fieldName = 'source';

  options: any = {
    language: 'css',
  };

  constructor(
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

  ngOnInit(): void {
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
