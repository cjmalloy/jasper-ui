import { KeyValuePipe } from '@angular/common';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, TemplateRef, ViewContainerRef, ChangeDetectionStrategy, viewChild, signal } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forOwn, uniq } from 'lodash-es';
import { catchError, concat, last, of, Subscription, throwError } from 'rxjs';
import { Config, Mod } from '../../../model/tag';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { equalBundle, formatBundleDiff, merge3 } from '../../../util/diff';
import { scrollToFirstInvalid } from '../../../util/form';
import { configGroups, formSafeNames, modId } from '../../../util/format';
import { printError } from '../../../util/http';
import { DiffComponent } from '../../../form/diff/diff.component';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { TemplatePortal } from '@angular/cdk/portal';

interface ModUpdatePreview {
  mod: string;
  proposed: Mod;
  diffBase: Mod;
  conflict: boolean;
}

@Component({
  selector: 'app-settings-setup-page',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FakeLinkDirective,
    ReactiveFormsModule,
    RouterLink,
    KeyValuePipe,
    DiffComponent,
    OverlayModule,
    LoadingComponent,
  ],
})
export class SettingsSetupPage implements OnDestroy {

  private readonly _submitted = signal<boolean>(false);
  get submitted() { return this._submitted(); }
  set submitted(value: boolean) { this._submitted.set(value); }
  private readonly _serverError = signal<string[]>([]);
  get serverError() { return this._serverError(); }
  set serverError(value: string[]) { this._serverError.set(value); }
  private readonly _installMessages = signal<string[]>([]);
  get installMessages() { return this._installMessages(); }
  set installMessages(value: string[]) { this._installMessages.set(value); }
  private readonly _mergeState = signal<ModUpdatePreview | undefined>(undefined);
  get mergeState() { return this._mergeState(); }
  set mergeState(value: ModUpdatePreview | undefined) { this._mergeState.set(value); }
  private readonly _mergeSaving = signal<Subscription | undefined>(undefined);
  get mergeSaving() { return this._mergeSaving(); }
  set mergeSaving(value: Subscription | undefined) { this._mergeSaving.set(value); }

  readonly mergePopup = viewChild<TemplateRef<any>>('mergePopup');

  experiments = !!this.admin.getTemplate('config/experiments');
  private readonly _selectAllToggle = signal<boolean>(false);
  get selectAllToggle() { return this._selectAllToggle(); }
  set selectAllToggle(value: boolean) { this._selectAllToggle.set(value); }
  adminForm: UntypedFormGroup;
  mergePopupSub = new Subscription();
  modGroups = configGroups({
    ...this.admin.status.disabledPlugins, ...this.admin.status.disabledTemplates,
    ...this.admin.status.plugins, ...this.admin.status.templates,
    ...this.admin.def.plugins, ...this.admin.def.templates });

  private mergePopupRef?: OverlayRef;

  constructor(
    public admin: AdminService,
    private mod: ModService,
    public store: Store,
    private fb: UntypedFormBuilder,
    private overlay: Overlay,
    private vc: ViewContainerRef,
  ) {
    mod.setTitle($localize`Settings: Setup`);
    this.adminForm = fb.group({
      mods: fb.group(formSafeNames({...this.admin.def.plugins, ...this.admin.def.templates })),
    });
    this.clear();
  }

  ngOnDestroy() {
    this.cancelMerge();
  }

  install() {
    this.serverError = [];
    this.installMessages = [];
    this.submitted = true;
    this.adminForm.markAllAsTouched();
    if (!this.adminForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const deletes: string[] = [];
    const installs: string[] = [];
    for (const plugin in this.admin.def.plugins) {
      const formName = plugin.replace(/[.]/g, '-');
      const def = this.admin.def.plugins[plugin];
      const status = this.admin.status.plugins[plugin] || this.admin.status.disabledPlugins[plugin];
      if (!!status === !!this.adminForm.value.mods[formName]) continue;
      if (this.adminForm.value.mods[formName]) {
        installs.push(modId(def));
      } else {
        deletes.push(modId(status));
      }
    }
    for (const template in this.admin.def.templates) {
      const formName = template.replace(/[.]/g, '-');
      const def = this.admin.def.templates[template];
      const status = this.admin.status.templates[template] || this.admin.status.disabledTemplates[template];
      if (!!status === !!this.adminForm.value.mods[formName]) continue;
      if (this.adminForm.value.mods[formName]) {
        installs.push(modId(def));
      } else {
        deletes.push(modId(status));
      }
    }
    const _ = (msg?: string) => this.installMessages = [...this.installMessages, msg!];
    if (!deletes.length && !installs.length) {
      this.submitted = true;
      _($localize`Success.`);
      return;
    }
    concat(
      ...uniq(deletes).map(m => this.admin.deleteMod$(m, _)),
      ...uniq(installs).map(m => this.admin.installMod$(m, _))
    ).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
      last(),
    ).subscribe(() => {
      this.submitted = true;
      this.reset();
      _($localize`Success.`);
    });
  }

  reset() {
    this.admin.init$.subscribe(() => this.clear());
  }

  clear() {
    this.adminForm.reset({
      mods: formSafeNames({
        ...this.admin.status.plugins,
        ...this.admin.status.disabledPlugins,
        ...this.admin.status.templates,
        ...this.admin.status.disabledTemplates,
      }),
    });
  }

  updateAll() {
    const _ = (msg?: string) => this.installMessages = [...this.installMessages, msg!];
    const mods: string[] = [];
    for (const plugin in this.admin.status.plugins) {
      const m = modId(this.admin.status.plugins[plugin]);
      if (this.store.view.modUpdates.has(m)) mods.push(m);
    }
    for (const template in this.admin.status.templates) {
      const m = modId(this.admin.status.templates[template]);
      if (this.store.view.modUpdates.has(m)) mods.push(m);
    }
    concat(...uniq(mods).map(mod => {
      const receipt = this.admin.getMod(mod)!;
      if (!this.admin.getTemplate('config/diff') || !this.hasCustomChangesMod(mod)) {
        return this.admin.updateMod$(mod, receipt, receipt, _);
      }
      this.mergeState = this.getModDiff(mod);
      if (this.mergeState?.conflict) {
        // skip
        return of(null)
      } else {
        return this.admin.updateMod$(mod, this.mergeState.proposed, receipt, _);
      }
    })).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).pipe(last()).subscribe(() => {
      this.submitted = true;
      this.reset();
      _($localize`Success.`);
    });
  }

  selectAll() {
    this.selectAllToggle = !this.selectAllToggle;
    forOwn((this.adminForm.get('mods') as UntypedFormGroup).controls, c => {
      c.setValue(this.selectAllToggle);
    });
  }

  updateMod(config: Config) {
    const mod = modId(config);
    const receipt = this.admin.getMod(mod)!;
    const _ = (msg?: string) => this.installMessages = [...this.installMessages, msg!];
    if (!this.admin.getTemplate('config/diff') || !this.hasCustomChanges(config)) {
      this.admin.updateMod$(mod, receipt, receipt, _).subscribe(() => {
        this.reset();
        _($localize`Success.`);
      });
      return;
    }
    this.mergeState = this.getModDiff(modId(config));
    if (this.mergeState?.conflict) {
      this.openMergePopup();
    } else {
      this.admin.updateMod$(mod, this.mergeState.proposed, receipt, _).subscribe(() => {
        this.reset();
        _($localize`Success.`);
      });
    }
  }

  diffMod(config: Config) {
    this.serverError = [];
    this.mergeState = this.getModDiff(modId(config));
    this.openMergePopup();
  }

  private getModDiff(mod: string): ModUpdatePreview {
    const current = this.admin.getInstalledMod(mod);
    if (!current) throw new Error(`Mod ${mod} not installed`);
    const target = this.admin.getMod(mod)!;
    if (!this.admin.getPlugin('plugin/mod/receipt')) {
      return {
        mod,
        proposed: target,
        diffBase: current,
        conflict: false,
      };
    }
    const base = this.admin.status.receipts[mod]?.plugins?.['plugin/mod'];
    if (base && !equalBundle(current, base)) {
      const merged = merge3(formatBundleDiff(current), formatBundleDiff(base), formatBundleDiff(target));
      if (!merged.result || merged.conflict) {
        return {
          mod,
          proposed: current,
          diffBase: target,
          conflict: true,
        };
      }
      return {
        mod,
        proposed: JSON.parse(merged.result),
        diffBase: target,
        conflict: false,
      };
    }
    return {
      mod,
      proposed: target,
      diffBase: current,
      conflict: false,
    };
  }

  needsModUpdate(config: Config) {
    return this.store.view.modUpdates.has(modId(config));
  }

  hasCustomChanges(config: Config) {
    return this.store.view.modChanges.get(modId(config));
  }

  hasCustomChangesMod(mod: string) {
    return this.store.view.modChanges.get(mod);
  }

  canDiffMod(config: Config) {
    if (!this.admin.getTemplate('config/diff')) return;
    return this.needsModUpdate(config) || this.hasCustomChanges(config);
  }

  private openMergePopup() {
    const mergePopup = this.mergePopup();
    if (!mergePopup || this.mergePopupRef?.hasAttached()) return;
    this.mergePopupRef = this.overlay.create({
      height: window.visualViewport?.height ? window.visualViewport.height + 'px' : '100vh',
      width: '100vw',
      hasBackdrop: true,
      positionStrategy: this.overlay.position()
        .global()
        .centerHorizontally()
        .top('0'),
      scrollStrategy: this.overlay.scrollStrategies.block(),
    });
    this.mergePopupRef.attach(new TemplatePortal(mergePopup, this.vc));
    this.mergePopupSub.add(this.mergePopupRef.backdropClick().subscribe(() => this.cancelMerge()));
    this.mergePopupSub.add(this.mergePopupRef.keydownEvents().subscribe(event => {
      if (event.key === 'Escape') this.cancelMerge();
    }));
  }

  installed(config: Config) {
    const mod = modId(config);
    return Object.values(this.admin.status.plugins).find(p => p && mod === modId(p)) ||
      Object.values(this.admin.status.templates).find(t => t && mod === modId(t));
  }

  disabled(config: Config) {
    const mod = modId(config);
    return Object.values(this.admin.status.disabledPlugins).find(p => p && mod === modId(p)) ||
      Object.values(this.admin.status.disabledTemplates).find(t => t && mod === modId(t));
  }

  modLabel([tag, e]: [string, Config]) {
    return (e.config?.mod?.replace(/\W/g, '') || tag).toLowerCase();
  }

  applyMerge(bundle: Mod | null) {
    if (!this.mergeState || !bundle) return;
    this.serverError = [];
    const _ = (msg?: string) => this.installMessages = [...this.installMessages, msg!];
    this.mergeSaving = this.admin.updateMod$(this.mergeState.mod, bundle, this.admin.getMod(this.mergeState.mod)!, _)
      .pipe(catchError((res: HttpErrorResponse) => {
        this.mergeSaving = undefined;
        return throwError(() => res);
      }))
      .subscribe(() => {
        this.cancelMerge();
        this.reset();
        _($localize`Success.`);
      });
  }

  cancelMerge() {
    this.mergeState = undefined;
    this.mergeSaving?.unsubscribe();
    this.mergeSaving = undefined;
    this.mergePopupSub.unsubscribe();
    this.mergePopupSub = new Subscription();
    this.mergePopupRef?.dispose();
    this.mergePopupRef = undefined;
  }
}
