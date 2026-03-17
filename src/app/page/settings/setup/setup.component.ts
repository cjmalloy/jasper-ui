import { KeyValuePipe } from '@angular/common';
import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { HttpErrorResponse } from '@angular/common/http';
import { TemplatePortal } from '@angular/cdk/portal';
import { Component, OnDestroy, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forOwn, uniq } from 'lodash-es';
import { catchError, concat, EMPTY, last, of, Subscription, tap, throwError } from 'rxjs';
import { Config, Mod } from '../../../model/tag';
import { AdminService, equalBundle, restoreBundle } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { formatBundleDiff, merge3 } from '../../../util/diff';
import { scrollToFirstInvalid } from '../../../util/form';
import { configGroups, formSafeNames, modId } from '../../../util/format';
import { printError } from '../../../util/http';
import { DiffComponent } from '../../../form/diff/diff.component';

interface ModUpdatePreview {
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
  loadModRefsSub = new Subscription();
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
    concat(...uniq(mods).map(mod => {
      const preview = this.getModUpdatePreview(mod);
      if (!preview) return of(null);
      if (preview.needsReview) {
        this.setMergeState(preview);
        return of(null);
      }
      return this.admin.updateMod$(mod, preview.proposed, preview.target, _);
    })).pipe(
      last(),
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
    const _ = (msg?: string) => this.installMessages.push(msg!);
    this.admin.updateMod$(this.mergeState.mod, bundle, this.mergeState.target, _)
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
    if (!this.installed(config)) return false;
    const mod = modId(config);
    const base = this.admin.getInstalledMod(mod);
    return !!base && !equalBundle(this.admin.getCurrentMod(mod), base);
  }

  installed(config: Config) {
    const exact = this.admin.status.plugins[config.tag] || this.admin.status.templates[config.tag];
    if (exact) return exact;
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

  canDiffMod(config: Config) {
    return !!this.needsModUpdate(config) &&
      !!this.admin.getPlugin('plugin/mod') &&
      !!this.admin.getTemplate('config/diff');
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
    this.loadModRefsSub.add(this.loadModRefs$().subscribe(() => this.clear()));
  }

  private loadModRefs$() {
    return this.admin.loadModRefsFor$(Object.values(this.modGroups)
      .flatMap(group => group.map(([, config]) => modId(config))));
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

  private canWriteReceiptsAfterInstall(installs: string[]) {
    return !!this.admin.getPlugin('plugin/mod') || installs.includes(modId(this.admin.def.plugins['plugin/mod']));
  }
}
