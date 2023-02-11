import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import * as moment from 'moment';
import { Icon, Plugin, visible } from '../../../model/plugin';
import { AdminService } from '../../../service/admin.service';
import { Store } from '../../../store/store';
import { intervalValidator } from '../../../util/form';
import { ORIGIN_REGEX, ORIGIN_WILDCARD_REGEX } from '../../../util/format';
import { TagsFormComponent } from '../../tags/tags.component';

@Component({
  selector: 'app-form-origin',
  templateUrl: './origin.component.html',
  styleUrls: ['./origin.component.scss']
})
export class OriginFormComponent implements OnInit {

  @Input()
  plugins!: UntypedFormGroup;
  @Output()
  togglePlugin = new EventEmitter<string>();

  @ViewChild(TagsFormComponent)
  tags!: TagsFormComponent;

  pull = this.admin.getPlugin('+plugin/origin/pull');
  push = this.admin.getPlugin('+plugin/origin/push');

  constructor(
    private admin: AdminService,
  ) { }

  ngOnInit(): void {
  }

  get config() {
    return this.plugins.get('+plugin/origin') as UntypedFormGroup;
  }

  get pullConfig() {
    return this.plugins.get('+plugin/origin/pull') as UntypedFormGroup;
  }

  get pushConfig() {
    return this.plugins.get('+plugin/origin/push') as UntypedFormGroup;
  }

  get local() {
    return this.config.get('local') as UntypedFormControl;
  }

  get remote() {
    return this.config.get('remote') as UntypedFormControl;
  }

  get pullProxy() {
    return this.pullConfig.get('proxy') as UntypedFormControl;
  }

  get pushProxy() {
    return this.pushConfig.get('proxy') as UntypedFormControl;
  }

  get pullQuery() {
    return this.pullConfig.get('query') as UntypedFormControl;
  }

  get pushQuery() {
    return this.pushConfig.get('query') as UntypedFormControl;
  }

  get pullInterval() {
    return this.pullConfig.get('pullInterval') as UntypedFormControl;
  }

  get pushInterval() {
    return this.pushConfig.get('pushInterval') as UntypedFormControl;
  }

  convertInterval() {
    this.pullInterval?.setValue(moment.duration(this.pullInterval.value));
    this.pushInterval?.setValue(moment.duration(this.pushInterval.value));
  }

  setValue(value: any) {
    this.plugins.patchValue(value);
    if (this.pullConfig) this.tags.setValue(value['+plugin/origin/pull'].addTags);
  }
}

export function originForm(fb: UntypedFormBuilder, admin: AdminService) {
  const result = fb.group({
    local: ['', [Validators.pattern(ORIGIN_WILDCARD_REGEX)]],
    remote: ['', [Validators.pattern(ORIGIN_WILDCARD_REGEX)]],
  });
  result.patchValue(admin.status.plugins.origin?.defaults);
  return result;
}

export function pullForm(fb: UntypedFormBuilder, admin: AdminService) {
  const result = fb.group({
    pullInterval: ['PT15M', [intervalValidator()]],
    lastPull: [''],
    query: [''],
    proxy: [''],
    batchSize: [250],
    generateMetadata: [true],
    removeTags: fb.array([]),
    mapTags: fb.group({}),
    addTags: fb.array([]),
    mapOrigins: fb.group({}),
  });
  result.patchValue(admin.status.plugins.origin?.defaults);
  return result;
}

export function pushForm(fb: UntypedFormBuilder, admin: AdminService) {
  const result = fb.group({
    pushInterval: ['PT15M', [intervalValidator()]],
    lastPush: [''],
    query: [''],
    proxy: [''],
    batchSize: [250],
  });
  result.patchValue(admin.status.plugins.origin?.defaults);
  return result;
}
