import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { defer } from 'lodash-es';
import { catchError, Observable, of } from 'rxjs';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { GenFormComponent } from '../../../form/plugins/gen/gen.component';
import { Plugin } from '../../../model/plugin';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { LoadingComponent } from '../../loading/loading.component';

@Component({
  selector: 'app-inline-plugin',
  templateUrl: './inline-plugin.component.html',
  styleUrls: ['./inline-plugin.component.scss'],
  host: { 'class': 'action' },
  imports: [FakeLinkDirective, GenFormComponent, LoadingComponent]
})
export class InlinePluginComponent {
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

  save() {
    this.editing.set(false);
    this.acting.set(true);
    this.action()(this.group().value).pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting.set(false));
  }

}
