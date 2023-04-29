import { AfterViewInit, Component, Input, OnDestroy } from '@angular/core';
import { FormControl, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { autorun, IReactionDisposer } from 'mobx';
import { Subject, takeUntil } from 'rxjs';
import { Store } from '../../store/store';

@Component({
  selector: 'app-json',
  templateUrl: './json.component.html',
  styleUrls: ['./json.component.scss']
})
export class JsonComponent implements AfterViewInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];
  private destroy$ = new Subject<void>();

  @Input()
  group!: UntypedFormGroup;
  @Input()
  fieldName = 'source';
  @Input()
  diff?: string;

  stringControl = new FormControl();

  options: any = {
    language: 'json',
    automaticLayout: true,
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

  get control() {
    return this.group.get(this.fieldName) as UntypedFormControl;
  }

  ngAfterViewInit(): void {
    this.control.valueChanges.pipe(
      takeUntil(this.destroy$),
    ).subscribe(
      value => {
        this.stringControl.setValue(JSON.stringify(value, null, 2));
      }
    );
    this.stringControl.valueChanges.pipe(
      takeUntil(this.destroy$),
    ).subscribe(
      value => {
        this.control.setValue(JSON.parse(value), { emitEvent: false });
      }
    );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  setValue(model: any) {
    this.control.setValue(model);
    // this.stringControl.setValue(JSON.stringify(model, null, 2));
  }

}
