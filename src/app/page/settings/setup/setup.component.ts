import { A11yModule } from '@angular/cdk/a11y';
import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal, TemplateRef, viewChild, ViewContainerRef } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { cloneDeep, forOwn, omit, sortBy, uniq } from 'lodash-es';
import { catchError, concat, EMPTY, last, Observable, of, Subscription, switchMap, tap, throwError } from 'rxjs';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { AdminConfigComponent } from '../../../form/admin-config/admin-config.component';
import { DiffComponent } from '../../../form/diff/diff.component';
import { Plugin } from '../../../model/plugin';
import { Config, Mod, ModType } from '../../../model/tag';
import { Template } from '../../../model/template';
import { AdminService } from '../../../service/admin.service';
import { PluginService } from '../../../service/api/plugin.service';
import { TemplateService } from '../../../service/api/template.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { equalBundle, mergeBundle } from '../../../util/diff';
import { controlState, scrollToFirstInvalid } from '../../../util/form';
import { configGroups, formSafeNames, modId } from '../../../util/format';
import { printError } from '../../../util/http';

interface ModUpdatePreview {
  mod: string;
  proposed: Mod;
  diffBase: Mod;
  conflict: boolean;
}

interface ModConfigEntry {
  type: 'plugin' | 'template';
  entity: Plugin | Template;
  fields: FormlyFieldConfig[];
  group: FormGroup<{ config: FormControl<string> }>;
}

interface ModConfigState {
  mod: string;
  entries: ModConfigEntry[];
}

@Component({
  selector: 'app-settings-setup-page',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss'],
  imports: [
    FakeLinkDirective,
    ReactiveFormsModule,
    RouterLink,
    KeyValuePipe,
    NgTemplateOutlet,
    DiffComponent,
    OverlayModule,
    LoadingComponent,
    AdminConfigComponent,
    A11yModule,
  ],
})
export class SettingsSetupPage {
  admin = inject(AdminService);
  private mod = inject(ModService);
  private plugins = inject(PluginService);
  private templates = inject(TemplateService);
  store = inject(Store);
  private fb = inject(UntypedFormBuilder);
  private overlay = inject(Overlay);
  private vc = inject(ViewContainerRef);


  readonly submitted = signal<boolean>(false);
  readonly serverError = signal<string[]>([]);
  readonly installMessages = signal<string[]>([]);
  readonly mergeState = signal<ModUpdatePreview | undefined>(undefined);
  readonly mergeSaving = signal(false);
  readonly configState = signal<ModConfigState | undefined>(undefined);
  readonly configSaving = signal(false);
  readonly configErrors = signal<string[]>([]);
  readonly modChangesLoaded = signal(false);
  readonly modChangesError = signal<string[]>([]);
  readonly installingDefaults = computed(() => this.admin.installingDefaults());
  readonly noMods = computed(() => this.store.account.admin && !this.installingDefaults() && !this.admin.loading() && this.admin.noMods());
  readonly hasLog = computed(() => !!(this.modChangesError().length || this.serverError().length || this.installMessages().length));
  private mergeSavingSubscription?: Subscription;
  private modChangesSubscription?: Subscription;
  private configSavingSubscription?: Subscription;

  readonly mergePopup = viewChild<TemplateRef<any>>('mergePopup');
  readonly configPopup = viewChild<TemplateRef<any>>('configPopup');

  experiments = !!this.admin.getTemplate('config/experiments');
  readonly selectAllToggle = signal<boolean>(false);
  adminForm: UntypedFormGroup;
  protected readonly adminFormValid = controlState(() => this.adminForm, c => c.valid);
  mergePopupSub = new Subscription();
  modGroups = configGroups({
    ...this.admin.status().disabledPlugins, ...this.admin.status().disabledTemplates,
    ...this.admin.status().plugins, ...this.admin.status().templates,
    ...this.admin.def.plugins, ...this.admin.def.templates });

  private mergePopupRef?: OverlayRef;
  private configPopupRef?: OverlayRef;
  private configPopupSub = new Subscription();

  constructor() {
    const mod = this.mod;
    const fb = this.fb;

    mod.setTitle($localize`Settings: Setup`);
    this.adminForm = fb.group({
      mods: fb.group(formSafeNames({...this.admin.def.plugins, ...this.admin.def.templates })),
    });
    this.clear();
    this.loadModChanges(this.admin.ready$.pipe(tap(() => this.clear())));
  }

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.cancelMerge();
    this.cancelConfig();
    this.modChangesSubscription?.unsubscribe();
  });

  loadModChanges(ready$: Observable<any> = this.admin.ready$) {
    this.modChangesSubscription?.unsubscribe();
    this.modChangesLoaded.set(false);
    this.modChangesError.set([]);
    this.modChangesSubscription = ready$.pipe(
      switchMap(() => this.admin.loadModChanges$()),
      catchError((res: HttpErrorResponse) => {
        this.modChangesError.set(printError(res));
        return EMPTY;
      }),
    ).subscribe(() => this.modChangesLoaded.set(true));
  }

  install() {
    if (this.installingDefaults()) return;
    this.serverError.set([]);
    this.installMessages.set([]);
    this.submitted.set(true);
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
      const status = this.admin.status().plugins[plugin] || this.admin.status().disabledPlugins[plugin];
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
      const status = this.admin.status().templates[template] || this.admin.status().disabledTemplates[template];
      if (!!status === !!this.adminForm.value.mods[formName]) continue;
      if (this.adminForm.value.mods[formName]) {
        installs.push(modId(def));
      } else {
        deletes.push(modId(status));
      }
    }
    const _ = (msg?: string) => this.installMessages.update(messages => msg ? [...messages, msg] : messages);
    if (!deletes.length && !installs.length) {
      this.submitted.set(true);
      _($localize`Success.`);
      return;
    }
    concat(
      ...uniq(deletes).map(m => this.admin.deleteMod$(m, _)),
      ...this.receiptsFirst(uniq(installs)).map(m => this.admin.installMod$(m, _))
    ).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError.set(printError(res));
        return throwError(() => res);
      }),
      last(),
    ).subscribe(() => {
      this.submitted.set(true);
      this.reset();
      _($localize`Success.`);
    });
  }

  installDefaults() {
    if (this.installingDefaults()) return;
    this.serverError.set([]);
    this.installMessages.set([]);
    const install$ = this.admin.installDefaultsAndReload$();
    this.loadModChanges(this.admin.ready$.pipe(tap(() => this.clear())));
    install$.pipe(
      last(null, null),
      catchError((res: HttpErrorResponse) => {
        this.serverError.set(printError(res));
        return EMPTY;
      }),
    ).subscribe(() => {
      this.installMessages.update(messages => [...messages,
        $localize`Success.`,
        $localize`Reload the page to finish loading mod changes.`]);
    });
  }

  reset() {
    this.loadModChanges(this.admin.reload$().pipe(tap(() => {
      this.clear();
      this.installMessages.update(messages => [...messages, $localize`Reload the page to finish loading mod changes.`]);
    })));
  }

  clear() {
    this.adminForm.reset({
      mods: formSafeNames({
        ...this.admin.status().plugins,
        ...this.admin.status().disabledPlugins,
        ...this.admin.status().templates,
        ...this.admin.status().disabledTemplates,
      }),
    });
  }

  updateAll() {
    const _ = (msg?: string) => this.installMessages.update(messages => msg ? [...messages, msg] : messages);
    const mods: string[] = [];
    for (const plugin in this.admin.status().plugins) {
      const m = modId(this.admin.status().plugins[plugin]);
      if (this.store.view.modUpdates().has(m)) mods.push(m);
    }
    for (const template in this.admin.status().templates) {
      const m = modId(this.admin.status().templates[template]);
      if (this.store.view.modUpdates().has(m)) mods.push(m);
    }
    if (!mods.length) return;
    concat(...this.receiptsFirst(uniq(mods)).map(mod => {
      const receipt = this.admin.getMod(mod)!;
      if (!this.hasCustomChangesMod(mod)) {
        return this.admin.updateMod$(mod, receipt, receipt, _);
      }
      const diff = this.getModDiff(mod);
      if (diff.conflict) {
        _($localize`⚠️ Skipped ${mod} mod: unable to merge local changes automatically. Use diff to update manually.`);
        return of(null);
      } else {
        return this.admin.updateMod$(mod, diff.proposed, receipt, _);
      }
    })).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError.set(printError(res));
        return throwError(() => res);
      }),
    ).pipe(last()).subscribe(() => {
      this.submitted.set(true);
      this.reset();
      _($localize`Success.`);
    });
  }

  /**
   * Install the mod providing plugin/mod/receipt first, so every other mod in the batch logs a receipt.
   */
  private receiptsFirst(mods: string[]) {
    return sortBy(mods, m => this.admin.getMod(m)?.plugin?.some(p => p.tag === 'plugin/mod/receipt') ? 0 : 1);
  }

  selectAll() {
    this.selectAllToggle.set(!this.selectAllToggle());
    forOwn((this.adminForm.get('mods') as UntypedFormGroup).controls, c => {
      c.setValue(this.selectAllToggle());
    });
  }

  updateMod(config: Config) {
    const mod = modId(config);
    const receipt = this.admin.getMod(mod)!;
    const _ = (msg?: string) => this.installMessages.update(messages => msg ? [...messages, msg] : messages);
    if (!this.admin.getTemplate('config/diff') || !this.hasCustomChangesMod(mod)) {
      this.admin.updateMod$(mod, receipt, receipt, _).subscribe(() => {
        this.reset();
        _($localize`Success.`);
      });
      return;
    }
    this.mergeState.set(this.getModDiff(modId(config)));
    if (this.mergeState()?.conflict) {
      this.openMergePopup();
    } else {
      this.admin.updateMod$(mod, this.mergeState()!.proposed, receipt, _).subscribe(() => {
        this.reset();
        _($localize`Success.`);
      });
    }
  }

  diffMod(config: Config) {
    this.serverError.set([]);
    this.mergeState.set(this.getModDiff(modId(config)));
    this.openMergePopup();
  }

  private getModDiff(mod: string): ModUpdatePreview {
    const current = this.admin.getInstalledMod(mod);
    if (!current) throw new Error(`Mod ${mod} not installed`);
    const target = this.admin.getMod(mod)!;
    const base = this.admin.status().receipts[mod]?.plugins?.['plugin/mod'];
    if (!base) {
      if (equalBundle(current, target)) {
        return {
          mod,
          proposed: target,
          diffBase: current,
          conflict: false,
        };
      }
      return {
        mod,
        proposed: current,
        diffBase: target,
        conflict: true,
      };
    }
    if (!equalBundle(current, base)) {
      const merged = mergeBundle(current, base, target);
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
        proposed: merged.result,
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
    return this.store.view.modUpdates().has(modId(config));
  }

  hasCustomChanges(config: Config) {
    return this.store.view.modChanges().get(modId(config));
  }

  hasCustomChangesMod(mod: string) {
    return this.store.view.modChanges().get(mod);
  }

  canDiffMod(config: Config) {
    if (!this.admin.getTemplate('config/diff')) return;
    return this.needsModUpdate(config) || this.hasCustomChanges(config);
  }

  private openMergePopup() {
    const mergePopup = this.mergePopup();
    if (!mergePopup || this.mergePopupRef?.hasAttached()) return;
    this.mergePopupRef = this.createPopup();
    this.mergePopupRef.attach(new TemplatePortal(mergePopup, this.vc));
    this.mergePopupSub.add(this.mergePopupRef.backdropClick().subscribe(() => this.cancelMerge()));
    this.mergePopupSub.add(this.mergePopupRef.keydownEvents().subscribe(event => {
      if (event.key === 'Escape') this.cancelMerge();
    }));
  }

  private createPopup() {
    return this.overlay.create({
      height: window.visualViewport?.height ? window.visualViewport.height + 'px' : '100vh',
      width: '100vw',
      hasBackdrop: true,
      positionStrategy: this.overlay.position()
        .global()
        .centerHorizontally()
        .top('0'),
      scrollStrategy: this.overlay.scrollStrategies.block(),
    });
  }

  private modConfigEntries(mod: string): ModConfigEntry[] {
    const installed = this.admin.getInstalledMod(mod);
    if (!installed) return [];
    const entry = (type: 'plugin' | 'template', entity: Plugin | Template, fields: FormlyFieldConfig[]): ModConfigEntry => ({
      type,
      entity,
      fields: cloneDeep(fields),
      group: new FormGroup({
        config: new FormControl(JSON.stringify(omit(entity.config || {}, '_cache'), null, 2), { nonNullable: true }),
      }),
    });
    return [
      ...(installed.plugin || [])
        .filter(p => p.origin === this.store.account.origin() && p.config?.adminForm?.length)
        .map(p => entry('plugin', p, p.config!.adminForm!)),
      ...(installed.template || [])
        .filter(t => t.origin === this.store.account.origin())
        .map(t => ({ t, fields: this.admin.getTemplateAdminForm(t.tag) }))
        .filter(({ fields }) => fields.length)
        .map(({ t, fields }) => entry('template', t, fields)),
    ];
  }

  hasAdminForm(config: Config) {
    const installed = this.admin.getInstalledMod(modId(config));
    if (!installed) return false;
    return installed.plugin?.some(p => p.origin === this.store.account.origin() && p.config?.adminForm?.length) ||
      installed.template?.some(t => t.origin === this.store.account.origin() && this.admin.getTemplateAdminForm(t.tag).length);
  }

  configMod(config: Config) {
    const configPopup = this.configPopup();
    if (!configPopup || this.configPopupRef?.hasAttached()) return;
    const mod = modId(config);
    this.configErrors.set([]);
    this.configState.set({ mod, entries: this.modConfigEntries(mod) });
    this.configPopupRef = this.createPopup();
    this.configPopupRef.attach(new TemplatePortal(configPopup, this.vc));
    this.configPopupSub.add(this.configPopupRef.backdropClick().subscribe(() => {
      if (!this.configSaving()) this.cancelConfig();
    }));
    this.configPopupSub.add(this.configPopupRef.keydownEvents().subscribe(event => {
      if (event.key === 'Escape' && !this.configSaving()) this.cancelConfig();
    }));
  }

  saveConfig() {
    const state = this.configState();
    if (!state || this.configSaving()) return;
    this.configErrors.set([]);
    for (const e of state.entries) e.group.markAllAsTouched();
    if (state.entries.some(e => e.group.invalid)) {
      this.configErrors.set([$localize`Please fix the errors in the form.`]);
      return;
    }
    const updates: Observable<string>[] = [];
    let saved = false;
    for (const e of state.entries) {
      if (!e.group.dirty) continue;
      let config: any;
      try {
        config = JSON.parse(e.group.controls.config.value);
      } catch (err: any) {
        this.configErrors.update(errors => [...errors, err.message]);
        continue;
      }
      const update$ = e.type === 'plugin'
        ? this.plugins.update({ ...e.entity as Plugin, config })
        : this.templates.update({ ...e.entity as Template, config });
      updates.push(update$.pipe(tap(cursor => {
        saved = true;
        // Keep the new cursor so re-saving this entry after a partial failure passes the optimistic update check
        e.entity = { ...e.entity, config, modifiedString: cursor };
        e.group.markAsPristine();
      })));
    }
    if (this.configErrors().length) return;
    const _ = (msg?: string) => this.installMessages.update(messages => msg ? [...messages, msg] : messages);
    if (!updates.length) {
      this.cancelConfig();
      return;
    }
    this.configSaving.set(true);
    this.configSavingSubscription = concat(...updates).pipe(
      last(null, null),
      catchError((res: HttpErrorResponse) => {
        this.configSaving.set(false);
        this.configErrors.set(printError(res));
        // Earlier entries were saved, so refresh the installed mods while keeping the remaining edits
        if (saved) this.reset();
        return EMPTY;
      }),
    ).subscribe(() => {
      this.cancelConfig();
      this.reset();
      _($localize`Saved ${state.mod} config.`);
    });
    this.configSavingSubscription.add(() => this.configSaving.set(false));
  }

  cancelConfig() {
    this.configState.set(undefined);
    this.configErrors.set([]);
    this.configSavingSubscription?.unsubscribe();
    this.configSaving.set(false);
    this.configPopupSub.unsubscribe();
    this.configPopupSub = new Subscription();
    this.configPopupRef?.dispose();
    this.configPopupRef = undefined;
  }

  installed(config: Config) {
    const mod = modId(config);
    return Object.values(this.admin.status().plugins).find(p => p && mod === modId(p)) ||
      Object.values(this.admin.status().templates).find(t => t && mod === modId(t));
  }

  disabled(config: Config) {
    const mod = modId(config);
    return Object.values(this.admin.status().disabledPlugins).find(p => p && mod === modId(p)) ||
      Object.values(this.admin.status().disabledTemplates).find(t => t && mod === modId(t));
  }

  modTypeLabel(type: ModType | string) {
    switch (type) {
      case 'config': return $localize`:mod type|:Config`;
      case 'icon': return $localize`:mod type|:Icon`;
      case 'feature': return $localize`:mod type|:Feature`;
      case 'lens': return $localize`:mod type|:Lens`;
      case 'plugin': return $localize`:mod type|:Plugin`;
      case 'editor': return $localize`:mod type|:Editor`;
      case 'semantic': return $localize`:mod type|:Semantic`;
      case 'theme': return $localize`:mod type|:Theme`;
      case 'tool': return $localize`:mod type|:Tool`;
    }
    return type;
  }

  modLabel([tag, e]: [string, Config]) {
    return (e.config?.mod?.replace(/\W/g, '') || tag).toLowerCase();
  }

  applyMerge(bundle: Mod | null) {
    if (!this.mergeState() || !bundle) return;
    this.serverError.set([]);
    const _ = (msg?: string) => this.installMessages.update(messages => msg ? [...messages, msg] : messages);
    this.mergeSaving.set(true);
    this.mergeSavingSubscription = this.admin.updateMod$(this.mergeState()!.mod, bundle, this.admin.getMod(this.mergeState()!.mod)!, _)
      .pipe(catchError((res: HttpErrorResponse) => {
        this.mergeSaving.set(false);
        return throwError(() => res);
      }))
      .subscribe(() => {
        this.cancelMerge();
        this.reset();
        _($localize`Success.`);
      });
    this.mergeSavingSubscription?.add(() => this.mergeSaving.set(false));
  }

  cancelMerge() {
    this.mergeState.set(undefined);
    this.mergeSavingSubscription?.unsubscribe();
    this.mergeSaving.set(false);
    this.mergePopupSub.unsubscribe();
    this.mergePopupSub = new Subscription();
    this.mergePopupRef?.dispose();
    this.mergePopupRef = undefined;
  }
}
