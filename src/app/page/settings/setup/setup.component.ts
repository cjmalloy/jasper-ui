import { KeyValuePipe } from '@angular/common';
import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { HttpErrorResponse } from '@angular/common/http';
import { TemplatePortal } from '@angular/cdk/portal';
import { Component, OnDestroy, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forOwn, isEqual, uniq } from 'lodash-es';
import { EMPTY, catchError, concat, last, Observable, of, Subscription, tap, throwError, toArray } from 'rxjs';
import { Ext, writeExt } from '../../../model/ext';
import { Plugin, writePlugin } from '../../../model/plugin';
import { Ref, writeRef } from '../../../model/ref';
import { Config, Mod } from '../../../model/tag';
import { Template, writeTemplate } from '../../../model/template';
import { User, writeUser } from '../../../model/user';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { progress } from '../../../store/bus';
import { Store } from '../../../store/store';
import { formatDiff, merge3 } from '../../../util/diff';
import { scrollToFirstInvalid } from '../../../util/form';
import { configGroups, formSafeNames, modId } from '../../../util/format';
import { printError } from '../../../util/http';
import { DiffComponent } from '../../../form/diff/diff.component';

export interface ModUpdatePreview {
  mod: string;
  current: Mod;
  target: Mod;
  proposed: Mod;
  needsReview: boolean;
  conflict: boolean;
  reason?: 'conflict' | 'missing-base' | 'requested';
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
  mergePopupRef?: OverlayRef;
  mergePopupSub = new Subscription();
  modGroups = configGroups({
    ...this.admin.status.disabledPlugins, ...this.admin.status.disabledTemplates,
    ...this.admin.status.plugins, ...this.admin.status.templates,
    ...this.admin.def.plugins, ...this.admin.def.templates });

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
    concat(
      ...uniq(deletes).map(m => this.admin.deleteMod$(m, _)),
      ...uniq(installs).map(m => this.admin.installMod$(m, _))
    ).pipe(
      last(),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return EMPTY;
      }),
    ).subscribe(() => {
        this.submitted = true;
        this.reset();
        _($localize`Success.`);
      });
  }

  reset() {
    this.setMergeState();
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
    this.serverError = [];
    this.setMergeState();
    const _ = (msg?: string) => this.installMessages.push(msg!);
    const mods: string[] = [];
    for (const plugin in this.admin.status.plugins) {
      const status = this.admin.status.plugins[plugin];
      if (status?._needsUpdate) mods.push(modId(status));
    }
    for (const template in this.admin.status.templates) {
      const status = this.admin.status.templates[template];
      if (status?._needsUpdate) mods.push(modId(status));
    }
    concat(...uniq(mods).map(mod => this.updateMod$(mod, _)))
      .pipe(last(), catchError((res: HttpErrorResponse | { preview?: ModUpdatePreview }) => {
        this.handleUpdateError(res);
        return EMPTY;
      }))
      .subscribe(() => {
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
    this.updateMod$(modId(config), _)
      .pipe(catchError((res: HttpErrorResponse | { preview?: ModUpdatePreview }) => {
        this.handleUpdateError(res);
        return EMPTY;
      }))
      .subscribe(() => this.reset());
  }

  diffMod(config: Config) {
    this.serverError = [];
    this.setMergeState(this.getModUpdatePreview(modId(config), true));
  }

  applyMerge(bundle: Mod | null | undefined) {
    if (!this.mergeState || !bundle) return;
    this.serverError = [];
    const _ = (msg?: string) => this.installMessages.push(msg!);
    this.applyModUpdate$(this.mergeState.mod, bundle, this.mergeState.target, _)
      .pipe(catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return EMPTY;
      }))
      .subscribe(() => {
        this.setMergeState();
        this.reset();
        _($localize`Success.`);
      });
  }

  cancelMerge() {
    this.setMergeState();
  }

  needsModUpdate(config: Config) {
    const mod = modId(config);
    return Object.values(this.admin.status.plugins).find(p => p && mod === modId(p) && p._needsUpdate) ||
      Object.values(this.admin.status.templates).find(t => t && mod === modId(t) && t._needsUpdate);
  }

  modModified(config: Config) {
    const mod = modId(config);
    const base = this.getInstalledMod(mod);
    return !!base && !equalBundle(this.getCurrentMod(mod), base);
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

  private handleUpdateError(res: HttpErrorResponse | { preview?: ModUpdatePreview }) {
    if ('preview' in res && res.preview) {
      this.setMergeState(res.preview);
      return;
    }
    this.serverError = printError(res as HttpErrorResponse);
  }

  ngOnDestroy() {
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

  private getInstalledMod(mod: string) {
    return this.admin.status.modRefs[mod]?.plugins?.['plugin/mod'];
  }

  private getCurrentMod(mod: string) {
    const base = this.getInstalledMod(mod) || this.admin.getMod(mod) || {};
    return clearMod(<Mod> {
      ...base,
      plugin: this.getStatusPlugins(mod),
      template: this.getStatusTemplates(mod),
    });
  }

  private getModUpdatePreview(mod: string, requested = false): ModUpdatePreview | undefined {
    const target = this.admin.getMod(mod);
    if (!target) return undefined;
    const current = this.getCurrentMod(mod);
    const base = this.getInstalledMod(mod);
    if (base && !equalBundle(current, base)) {
      const merged = merge3(formatDiff(current), formatDiff(base), formatDiff(target));
      if (!merged.mergedComment || merged.conflict) {
        return {
          mod,
          current,
          target,
          proposed: target,
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
        needsReview: true,
        conflict: true,
        reason: 'missing-base',
      };
    }
    return {
      mod,
      current,
      target,
      proposed: target,
      needsReview: requested,
      conflict: false,
      reason: requested ? 'requested' : undefined,
    };
  }

  private updateMod$(mod: string, _: progress): Observable<any> {
    const preview = this.getModUpdatePreview(mod);
    if (!preview) return of(null);
    if (preview.needsReview) return throwError(() => ({ preview }));
    return this.applyModUpdate$(mod, preview.proposed, preview.target, _);
  }

  private applyModUpdate$(mod: string, bundle: Mod, cleanBundle: Mod, _: progress): Observable<any> {
    if (!bundle) return of(null);
    bundle = restoreBundle(cleanBundle, bundle);
    const currentPlugins = this.getStatusEntries(this.admin.status.plugins, this.admin.status.disabledPlugins, mod);
    const currentTemplates = this.getStatusEntries(this.admin.status.templates, this.admin.status.disabledTemplates, mod);
    const nextPlugins = bundle.plugin || [];
    const nextTemplates = bundle.template || [];
    return concat(...[
      of(null).pipe(tap(() => _($localize`Installing ${mod} mod...`))),
      ...currentPlugins
        .filter(current => !nextPlugins.find(next => next.tag === current.tag))
        .map(current => this.admin.deletePlugin$(current, _)),
      ...currentTemplates
        .filter(current => !nextTemplates.find(next => next.tag === current.tag))
        .map(current => this.admin.deleteTemplate$(current, _)),
      ...nextPlugins.map(plugin => (currentPlugins.find(current => current.tag === plugin.tag)
        ? this.admin.updatePlugin$(plugin, _)
        : this.admin.installPlugin$(plugin, _))),
      ...nextTemplates.map(template => (currentTemplates.find(current => current.tag === template.tag)
        ? this.admin.updateTemplate$(template, _)
        : this.admin.installTemplate$(template, _))),
      this.admin.logModReceipt$(mod, cleanBundle, _),
    ]).pipe(toArray());
  }

  private getStatusPlugins(mod: string) {
    return this.getStatusEntries(this.admin.status.plugins, this.admin.status.disabledPlugins, mod)
      .map(plugin => writePlugin({ ...plugin, origin: '' }));
  }

  private getStatusTemplates(mod: string) {
    return this.getStatusEntries(this.admin.status.templates, this.admin.status.disabledTemplates, mod)
      .map(template => writeTemplate({ ...template, origin: '' }));
  }

  private getStatusEntries<T extends Config & { tag: string }>(active: Record<string, T>, disabled: Record<string, T>, mod: string) {
    return [...Object.values(active), ...Object.values(disabled)]
      .filter((entry): entry is T => !!entry && modId(entry) === mod);
  }
}

function clearConfig<T extends Config>(config: T): T {
  const result = {
    ...config,
    config: config.config && { ...config.config },
  } as any;
  if (result.config) {
    delete result.config.version;
    delete result.config.generated;
  }
  delete result._needsUpdate;
  return result;
}

function clearMod(mod: Mod): Mod {
  const result = { ...mod } as any;
  if (mod.ref) result.ref = mod.ref.map((r: Ref) => writeRef(r));
  if (mod.ext) result.ext = mod.ext.map((e: Ext) => writeExt(e));
  if (mod.user) result.user = mod.user?.map((u: User) => writeUser(u));
  if (mod.plugin) result.plugin = mod.plugin.map((p: Plugin) => clearConfig(writePlugin(p)));
  if (mod.template) result.template = mod.template.map((t: Template) => clearConfig(writeTemplate(t)));
  return result;
}

function equalBundle(a?: Mod, b?: Mod) {
  if (!a || !b) return false;
  return isEqual(clearMod(a), clearMod(b));
}

function restoreBundle(target: Mod, merged: Mod) {
  return {
    ...target,
    ...merged,
    plugin: restoreConfigEntries(target.plugin, merged.plugin),
    template: restoreConfigEntries(target.template, merged.template),
  } as Mod;
}

function restoreConfigEntries<Entry extends Config & { tag: string }>(target: Entry[] | undefined, merged: Entry[] | undefined) {
  const targetByTag = new Map((target || []).map(entry => [entry.tag, entry]));
  return (merged || []).map(entry => {
    const existing = targetByTag.get(entry.tag);
    if (!existing) return entry;
    return {
      ...existing,
      ...entry,
      config: {
        ...existing.config || {},
        ...entry.config,
      },
    };
  });
}
