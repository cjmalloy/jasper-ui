import { KeyValuePipe } from '@angular/common';
import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { HttpErrorResponse } from '@angular/common/http';
import { TemplatePortal } from '@angular/cdk/portal';
import { Component, OnDestroy, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forOwn, isEqual, uniq } from 'lodash-es';
import { catchError, concat, EMPTY, last, Subscription, throwError } from 'rxjs';
import { Plugin, writePlugin } from '../../../model/plugin';
import { Config, Mod } from '../../../model/tag';
import { Template, writeTemplate } from '../../../model/template';
import { AdminService, equalBundle, restoreBundle } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { formatBundleDiff, merge3 } from '../../../util/diff';
import { scrollToFirstInvalid } from '../../../util/form';
import { configGroups, formSafeNames, modId } from '../../../util/format';
import { printError } from '../../../util/http';
import { DiffComponent } from '../../../form/diff/diff.component';
import { LoadingComponent } from '../../../component/loading/loading.component';

interface ModUpdatePreview {
  mod: string;
  current: Mod;
  target: Mod;
  proposed: Mod;
  diffBase: Mod;
  needsReview: boolean;
  conflict: boolean;
  reason?: 'conflict' | 'requested';
}

@Component({
  selector: 'app-settings-setup-page',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss'],
  imports: [
    ReactiveFormsModule,
    RouterLink,
    KeyValuePipe,
    DiffComponent,
    OverlayModule,
    LoadingComponent,
  ],
})
export class SettingsSetupPage implements OnDestroy {
  @ViewChild('mergePopup')
  mergePopup?: TemplateRef<unknown>;

  experiments = !!this.admin.getTemplate('config/experiments');
  selectAllToggle = false;
  submitted = false;
  adminForm: UntypedFormGroup;
  serverError: string[] = [];
  installMessages: string[] = [];
  mergeState?: ModUpdatePreview;
  mergeSaving = false;
  mergePopupRef?: OverlayRef;
  mergePopupSub = new Subscription();
  loadModRefsSub = new Subscription();
  loggedModifiedMods = new Set<string>();
  modGroups = this.buildModGroups();
  pendingMods: string[] = [];

  constructor(
    public admin: AdminService,
    private mod: ModService,
    public store: Store,
    private fb: UntypedFormBuilder,
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
  ) {
    mod.setTitle($localize`Settings: Setup`);
    this.adminForm = fb.group({
      mods: fb.group(formSafeNames({...this.admin.def.plugins, ...this.admin.def.templates })),
    });
    this.clear();
    this.loadModRefs();
  }

  install() {
    this.serverError = [];
    this.installMessages = [];
    this.setMergeState();
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
    const _ = (msg?: string) => this.installMessages.push(msg!);
    if (!deletes.length && !installs.length) {
      this.submitted = true;
      _($localize`Success.`);
      return;
    }
    const installIds = uniq(installs);
    concat(
      ...uniq(deletes).map(m => this.admin.deleteMod$(m, _)),
      ...installIds.map(m => this.admin.installMod$(m, _, false)),
      ...(this.canWriteReceiptsAfterInstall(installIds)
        ? installIds
          .map(m => ({ mod: m, bundle: this.admin.getMod(m) }))
          .filter((entry): entry is { mod: string, bundle: Mod } => !!entry.bundle)
          .map(entry => this.admin.logModReceipt$(entry.mod, entry.bundle, _))
        : [])
    ).pipe(
      last(),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
        this.submitted = true;
        this.reset();
        _($localize`Success.`);
      });
  }

  reset() {
    this.setMergeState();
    this.admin.init$.subscribe(() => this.loadModRefs());
  }

  clear() {
    this.loggedModifiedMods.clear();
    this.modGroups = this.buildModGroups();
    this.pendingMods = this.getModsNeedingUpdate();
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
    this.serverError = [];
    this.setMergeState();
    const _ = (msg?: string) => this.installMessages.push(msg!);
    const allMods = this.pendingMods;
    const modsToUpdate: { mod: string, preview: ModUpdatePreview }[] = [];
    for (const mod of allMods) {
      const preview = this.getModUpdatePreview(mod);
      if (!preview) continue;
      if (preview.needsReview) {
        this.setMergeState(preview);
        return;
      }
      modsToUpdate.push({ mod, preview });
    }
    if (!modsToUpdate.length) {
      this.submitted = true;
      this.reset();
      _($localize`Success.`);
      return;
    }
    concat(...modsToUpdate.map(({ mod, preview }) =>
      this.admin.updateMod$(mod, preview.proposed, preview.target, _)
    )).pipe(
      last(),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.submitted = true;
      this.reset();
      _($localize`Success.`);
    });
  }

  selectAll() {
    this.selectAllToggle = !this.selectAllToggle;
    const sa = (fg: UntypedFormGroup) => forOwn(fg.controls, c => c.setValue(this.selectAllToggle));
    sa(this.adminForm.get('mods') as UntypedFormGroup);
  }

  updateMod(config: Config) {
    this.serverError = [];
    this.setMergeState();
    const _ = (msg?: string) => this.installMessages.push(msg!);
    const mod = modId(config);
    const preview = this.getModUpdatePreview(mod);
    if (!preview) return;
    if (preview.needsReview) {
      this.setMergeState(preview);
      return;
    }
    this.admin.updateMod$(mod, preview.proposed, preview.target, _)
      .subscribe(() => this.reset());
  }

  diffMod(config: Config) {
    if (!this.canDiffMod(config)) return;
    this.serverError = [];
    this.setMergeState(this.getModUpdatePreview(modId(config), true));
  }

  applyMerge(bundle: Mod | null | undefined) {
    if (!this.mergeState || !bundle) return;
    this.serverError = [];
    this.mergeSaving = true;
    const _ = (msg?: string) => this.installMessages.push(msg!);
    this.admin.updateMod$(this.mergeState.mod, bundle, this.mergeState.target, _)
      .pipe(catchError((res: HttpErrorResponse) => {
        this.mergeSaving = false;
        this.serverError = printError(res);
        return EMPTY;
      }))
      .subscribe(() => {
        this.mergeSaving = false;
        this.setMergeState();
        this.reset();
        _($localize`Success.`);
      });
  }

  cancelMerge() {
    if (this.mergeSaving) return;
    this.setMergeState();
  }

  needsModUpdate(config: Config) {
    const mod = this.getResolvedModId(config);
    return Object.values(this.admin.status.plugins).find(p => p && mod === modId(p) && p._needsUpdate) ||
      Object.values(this.admin.status.templates).find(t => t && mod === modId(t) && t._needsUpdate);
  }

  /** Filters status-level update flags with the installed receipt so custom-only edits don't show as pending upgrades. */
  hasPendingModUpdate(config: Config) {
    if (!this.needsModUpdate(config)) return false;
    const mod = this.getResolvedModId(config);
    return !mod || !this.admin.getInstalledMod(mod) || this.hasPendingInstalledModUpdate(mod);
  }

  hasPendingUpdates() {
    return this.pendingMods.length > 0;
  }

  modModified(config: Config) {
    const state = this.getModModification(config);
    if (!state?.mod || !state.modified) {
      if (state?.mod) this.loggedModifiedMods.delete(state.mod);
      return false;
    }
    this.logModifiedIndicator(state.mod, state.current, state.base);
    return true;
  }

  installed(config: Config) {
    const exact = this.getCurrentConfig(config);
    if (exact) return exact;
    const mod = this.getResolvedModId(config);
    return Object.values(this.admin.status.plugins).find(p => p && mod === modId(p)) ||
      Object.values(this.admin.status.templates).find(t => t && mod === modId(t));
  }

  disabled(config: Config) {
    const exact = this.getDisabledConfig(config);
    if (exact) return exact;
    const mod = this.getResolvedModId(config);
    return Object.values(this.admin.status.disabledPlugins).find(p => p && mod === modId(p)) ||
      Object.values(this.admin.status.disabledTemplates).find(t => t && mod === modId(t));
  }

  modLabel([tag, e]: [string, Config]) {
    return (e.config?.mod?.replace(/\W/g, '') || tag).toLowerCase();
  }

  canDiffMod(config: Config) {
    const hasCustomChanges = !!this.getModModification(config)?.modified;
    return (this.hasPendingModUpdate(config) || hasCustomChanges)
      && !!this.admin.getPlugin('plugin/mod')
      && !!this.admin.getTemplate('config/diff');
  }

  ngOnDestroy() {
    this.loadModRefsSub.unsubscribe();
    this.closeMergePopup();
  }

  private setMergeState(preview?: ModUpdatePreview) {
    this.mergeState = preview;
    if (preview) {
      this.openMergePopup();
    } else {
      this.closeMergePopup();
    }
  }

  private openMergePopup() {
    if (!this.mergePopup || this.mergePopupRef?.hasAttached()) return;
    this.mergePopupRef = this.overlay.create({
      height: this.getOverlayHeight(),
      width: '100vw',
      hasBackdrop: true,
      positionStrategy: this.overlay.position()
        .global()
        .centerHorizontally()
        .top('0'),
      scrollStrategy: this.overlay.scrollStrategies.block(),
    });
    this.mergePopupRef.attach(new TemplatePortal(this.mergePopup, this.viewContainerRef));
    this.mergePopupSub.add(this.mergePopupRef.backdropClick().subscribe(() => this.cancelMerge()));
    this.mergePopupSub.add(this.mergePopupRef.keydownEvents().subscribe(event => {
      if (event.key === 'Escape') this.cancelMerge();
    }));
  }

  private closeMergePopup() {
    this.mergePopupSub.unsubscribe();
    this.mergePopupSub = new Subscription();
    this.mergePopupRef?.dispose();
    this.mergePopupRef = undefined;
  }

  private getOverlayHeight() {
    return window.visualViewport?.height
      ? window.visualViewport.height + 'px'
      : '100vh';
  }

  private loadModRefs() {
    this.loadModRefsSub.unsubscribe();
    this.loadModRefsSub = this.loadModRefs$().subscribe(() => this.clear());
  }

  private loadModRefs$() {
    return this.admin.loadAllModRefs$();
  }

  private buildModGroups() {
    return configGroups({
      ...this.admin.status.disabledPlugins, ...this.admin.status.disabledTemplates,
      ...this.admin.status.plugins, ...this.admin.status.templates,
      ...this.admin.def.plugins, ...this.admin.def.templates,
    });
  }

  private getModModification(config: Config) {
    const currentConfig = this.getCurrentConfig(config) || this.disabled(config) || config;
    const mod = this.getResolvedModId(config);
    if (!mod || !this.installed(currentConfig)) return undefined;
    const current = this.admin.getCurrentMod(mod);
    const base = this.getModComparisonBase(mod, currentConfig, current);
    if (!current || !base) return undefined;
    return {
      mod,
      current,
      base,
      modified: this.hasCustomConfigChanges(current, base) as true | false,
    };
  }

  private getCurrentConfig(config: Config) {
    return this.admin.status.plugins[config.tag] ||
      this.admin.status.templates[config.tag];
  }

  private getDisabledConfig(config: Config) {
    return this.admin.status.disabledPlugins[config.tag] ||
      this.admin.status.disabledTemplates[config.tag];
  }

  private getResolvedModId(config: Config) {
    return config.config?.mod ||
      this.getCurrentConfig(config)?.config?.mod ||
      this.getDisabledConfig(config)?.config?.mod ||
      this.getInstalledModIdFor(config.tag) ||
      config.name ||
      config.tag ||
      '';
  }

  private getInstalledModIdFor(tag: string) {
    return Object.entries(this.admin.status.modRefs).find(([, ref]) =>
      ref?.plugins?.['plugin/mod']?.plugin?.some((plugin: Plugin) => plugin.tag === tag) ||
      ref?.plugins?.['plugin/mod']?.template?.some((template: Template) => template.tag === tag)
    )?.[0];
  }

  private getModComparisonBase(mod: string, config: Config, current: Mod | undefined) {
    const base = this.admin.getInstalledMod(mod);
    if (base || config.config?.version === undefined || !current) return base;
    const target = this.admin.getMod(mod);
    return target && !equalBundle(current, target) ? target : undefined;
  }

  private logModifiedIndicator(mod: string, current: Mod, base?: Mod) {
    if (!base || this.loggedModifiedMods.has(mod)) return;
    const changes = this.getConfigChanges(current, base);
    if (!changes.length) return;
    this.loggedModifiedMods.add(mod);
    changes.forEach(change => console.log('Has custom changes:', (change.tag || '/')));
  }

  private hasCustomConfigChanges(current?: Mod, base?: Mod) {
    return !!current && !!base && this.getConfigChanges(current, base).length > 0;
  }

  private getConfigChanges(current: Mod, base: Mod) {
    return [
      ...this.getChangedConfigs(current.plugin, base.plugin, plugin => this.normalizeConfig(writePlugin(plugin))),
      ...this.getChangedConfigs(current.template, base.template, template => this.normalizeConfig(writeTemplate(template))),
    ];
  }

  private hasPendingInstalledModUpdate(mod: string) {
    const installed = this.admin.getInstalledMod(mod);
    const target = this.admin.getMod(mod);
    if (!installed) return !!target;
    if (!target) return false;
    return this.hasPendingConfigUpdates(
      target.plugin,
      installed.plugin,
      plugin => this.normalizePendingUpdateConfig(writePlugin(plugin)),
    ) || this.hasPendingConfigUpdates(
      target.template,
      installed.template,
      template => this.normalizePendingUpdateConfig(writeTemplate(template)),
    );
  }

  private getChangedConfigs<T extends Config>(
    current: T[] | undefined,
    base: T[] | undefined,
    normalize: (entry: T) => object,
  ) {
    const currentMap = new Map((current || []).map(entry => [entry.tag, entry]));
    const baseMap = new Map((base || []).map(entry => [entry.tag, entry]));
    return uniq([...baseMap.keys(), ...currentMap.keys()])
      .map(tag => {
        const currentEntry = currentMap.get(tag);
        const baseEntry = baseMap.get(tag);
        if (!baseEntry) return currentEntry;
        if (!currentEntry) return baseEntry;
        return isEqual(normalize(currentEntry), normalize(baseEntry)) ? undefined : currentEntry;
      })
      .filter((entry): entry is T => !!entry);
  }

  /** Compares the bundled target with the installed receipt so only real upstream changes count as pending updates. */
  private hasPendingConfigUpdates<T extends Config>(
    target: T[] | undefined,
    installed: T[] | undefined,
    normalize: (entry: T) => object,
  ) {
    const targetMap = new Map((target || []).map(entry => [entry.tag, entry]));
    const installedMap = new Map((installed || []).map(entry => [entry.tag, entry]));
    return uniq([...targetMap.keys(), ...installedMap.keys()]).some(tag => {
      const targetEntry = targetMap.get(tag);
      const installedEntry = installedMap.get(tag);
      if (!targetEntry || !installedEntry) {
        return !isEqual(targetEntry && normalize(targetEntry), installedEntry && normalize(installedEntry));
      }
      return this.admin.needsUpdate(targetEntry, installedEntry) ||
        !isEqual(normalize(targetEntry), normalize(installedEntry));
    });
  }

  private normalizeConfig<T extends Config>(config: T) {
    const result = this.normalizePendingUpdateConfig(config);
    delete result.config?.version;
    return result;
  }

  private normalizePendingUpdateConfig<T extends Config>(config: T) {
    const result = { ...config } as any;
    result.config &&= { ...result.config };
    delete result.origin;
    delete result.modified;
    delete result.modifiedString;
    delete result._needsUpdate;
    delete result.config?.generated;
    delete result.config?._parent;
    return result;
  }

  private getModUpdatePreview(mod: string, requested = false): ModUpdatePreview | undefined {
    const target = this.admin.getMod(mod);
    if (!target) return undefined;
    const current = this.admin.getCurrentMod(mod);
    if (!this.admin.getPlugin('plugin/mod')) {
      return {
        mod,
        current,
        target,
        proposed: target,
        diffBase: current,
        needsReview: false,
        conflict: false,
      };
    }
    const base = this.admin.getInstalledMod(mod);
    if (base && !equalBundle(current, base)) {
      const merged = merge3(formatBundleDiff(current), formatBundleDiff(base), formatBundleDiff(target));
      if (!merged.mergedComment || merged.conflict) {
        return {
          mod,
          current,
          target,
          proposed: current,
          diffBase: target,
          needsReview: true,
          conflict: true,
          reason: 'conflict',
        };
      }
      return {
        mod,
        current,
        target,
        proposed: restoreBundle(target, JSON.parse(merged.mergedComment)),
        diffBase: target,
        needsReview: requested,
        conflict: false,
        reason: requested ? 'requested' : undefined,
      };
    }
    if (!base && !equalBundle(current, target)) {
      return {
        mod,
        current,
        target,
        proposed: target,
        diffBase: current,
        needsReview: requested,
        conflict: false,
      };
    }
    return {
      mod,
      current,
      target,
      proposed: target,
      diffBase: current,
      needsReview: requested,
      conflict: false,
      reason: requested ? 'requested' : undefined,
    };
  }

  private canWriteReceiptsAfterInstall(installs: string[]) {
    return !!this.admin.getPlugin('plugin/mod') || installs.includes(modId(this.admin.def.plugins['plugin/mod']));
  }

  private getModsNeedingUpdate() {
    return uniq([
      ...Object.values(this.admin.status.plugins)
        .filter(plugin => !!plugin && this.hasPendingModUpdate(plugin))
        .map(plugin => modId(plugin!)),
      ...Object.values(this.admin.status.templates)
        .filter(template => !!template && this.hasPendingModUpdate(template))
        .map(template => modId(template!)),
    ]);
  }
}
