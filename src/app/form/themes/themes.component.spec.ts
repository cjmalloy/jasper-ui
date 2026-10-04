/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';

import { ThemesFormComponent } from './themes.component';

describe('ThemesFormComponent', () => {
  let component: ThemesFormComponent;
  let fixture: ComponentFixture<ThemesFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        ThemesFormComponent,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ThemesFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('group', new UntypedFormGroup({}));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('derives theme keys from external form updates', () => {
    expect(component.keys()).toEqual([]);
    component.themes()!.addControl('custom', new UntypedFormControl('body {}'));
    expect(component.keys()).toEqual(['custom']);
    component.themes()!.removeControl('custom');
    expect(component.keys()).toEqual([]);
  });

  it('selects and initializes a different theme field reactively', () => {
    fixture.componentRef.setInput('fieldName', 'alternateThemes');
    fixture.detectChanges();
    expect(component.themes()).toBeTruthy();
    expect(component.themes()).toBe(component.group().get('alternateThemes'));
    component.addTheme('alternate');
    expect(component.keys()).toEqual(['alternate']);
  });
});
