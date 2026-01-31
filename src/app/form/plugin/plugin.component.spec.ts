import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';

import { PluginFormComponent } from './plugin.component';

describe('PluginFormComponent', () => {
  let component: PluginFormComponent;
  let fixture: ComponentFixture<PluginFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PluginFormComponent]
    ,
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PluginFormComponent);
    component = fixture.componentInstance;
    component.group = new UntypedFormGroup({
      tag: new UntypedFormControl(),
      name: new UntypedFormControl(),
      config: new UntypedFormControl(),
      defaults: new UntypedFormControl(),
      schema: new UntypedFormControl(),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
