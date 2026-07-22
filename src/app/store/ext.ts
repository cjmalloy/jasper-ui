import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { action, makeAutoObservable, observable, runInAction } from 'mobx';
import { catchError, EMPTY, Subscription } from 'rxjs';
import { Ext } from '../model/ext';
import { Page } from '../model/page';
import { TagPageArgs } from '../model/tag';
import { ExtService } from '../service/api/ext.service';

@Injectable({
  providedIn: 'root'
})
export class ExtStore {

  args?: TagPageArgs = {} as any;
  page?: Page<Ext> = {} as any;
  error?: HttpErrorResponse = {} as any;
  bulkToolsOpen = false;
  bulkDeselectedExtKeys = new Set<string>();

  private running?: Subscription;

  constructor(
    private exts: ExtService,
  ) {
    makeAutoObservable(this, {
      args: observable.struct,
      page: observable.ref,
      clear: action,
    });
    this.clear(); // Initial observables may not be null for MobX
  }

  clear() {
    this.args = undefined;
    this.page = undefined;
    this.error = undefined;
    this.setBulkToolsOpen(this.bulkToolsOpen);
    this.running?.unsubscribe();
  }

  bulkExtKey(ext: Ext) {
    return `${ext.origin || ''}@${ext.tag}`;
  }

  setBulkToolsOpen(open: boolean) {
    this.bulkToolsOpen = open;
    this.bulkDeselectedExtKeys = new Set<string>();
  }

  setBulkSelected(ext: Ext, selected: boolean) {
    const keys = new Set(this.bulkDeselectedExtKeys);
    if (selected) {
      keys.delete(this.bulkExtKey(ext));
    } else {
      keys.add(this.bulkExtKey(ext));
    }
    this.bulkDeselectedExtKeys = keys;
  }

  isBulkSelected(ext: Ext) {
    return !this.bulkDeselectedExtKeys.has(this.bulkExtKey(ext));
  }

  get bulkSelectedContent() {
    if (!this.page?.content) return [];
    if (!this.bulkToolsOpen) return this.page.content;
    return this.page.content.filter(ext => this.isBulkSelected(ext));
  }

  close() {
    if (this.running && !this.running.closed) this.clear();
  }

  setArgs(args: TagPageArgs) {
    if (!isEqual(omit(this.args, 'search'), omit(args, 'search'))) this.clear();
    this.args = args;
    this.refresh();
  }

  refresh() {
    if (!this.args) return;
    this.running?.unsubscribe();
    this.running = this.exts.page(this.args).pipe(
      catchError((err: HttpErrorResponse) => {
        runInAction(() => this.error = err);
        return EMPTY;
      }),
    ).subscribe(p => runInAction(() => this.page = p));
  }

}
