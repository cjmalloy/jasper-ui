import { Component, computed, effect, input, linkedSignal, output, signal, viewChild, untracked, inject } from '@angular/core';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { FormBuilder, UntypedFormGroup } from '@angular/forms';
import { defer } from 'lodash-es';
import { catchError, Observable, of } from 'rxjs';
import { GenFormComponent } from '../../../form/plugins/gen/gen.component';
import { Plugin } from '../../../model/plugin';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { LoadingComponent } from '../../loading/loading.component';
import { ActionComponent } from '../action.component';

@Component({
  selector: 'app-inline-plugin',
  templateUrl: './inline-plugin.component.html',
  styleUrls: ['./inline-plugin.component.scss'],
  host: { 'class': 'action' },
  imports: [FakeLinkDirective, GenFormComponent, LoadingComponent]
})
export class InlinePluginComponent extends ActionComponent {
  admin = inject(AdminService);
  private fb = inject(FormBuilder);


  readonly action = input<(plugins: any) => Observable<any | never>>(() => of(null));
  readonly plugin = input.required<Plugin>();
  readonly value = input<Partial<Ref>>();
  readonly error = output<string>();
  readonly gen = viewChild<GenFormComponent>('gen');

  readonly editing = linkedSignal(() => { this.plugin(); this.value(); return false; });
  readonly acting = signal(false);

  readonly group = computed(() => this.fb.group({
    [this.plugin().tag]: this.fb.group({}),
  }));

  constructor() {
    super();
    effect(() => {
      const gen = this.gen();
      const plugins = this.value()?.plugins || {};
      this.group();
      if (!gen) return;
      untracked(() => {
        defer(() => gen.setValue(plugins));
      });
    });
  }

  override reset() {
    this.editing.set(false);
    this.acting.set(false);
  }

  override active() {
    return this.editing() || this.acting();
  }

  save() {
    this.editing.set(false);
    this.acting.set(true);
    this.action()(this.group().value).pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting.set(false));
  }

}
