/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormArray, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { provideJasperFormly } from '../../formly/formly.config';

import { UserFormComponent } from './user.component';

describe('UserFormComponent', () => {
  let component: UserFormComponent;
  let fixture: ComponentFixture<UserFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        UserFormComponent,
      ],
      providers: [
        provideJasperFormly(),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('group', new UntypedFormGroup({
      tag: new UntypedFormControl(),
      name: new UntypedFormControl(),
      role: new UntypedFormControl(),
      pubKey: new UntypedFormControl(),
      authorizedKeys: new UntypedFormControl(),
      readAccess: new UntypedFormArray([]),
      writeAccess: new UntypedFormArray([]),
      tagReadAccess: new UntypedFormArray([]),
      tagWriteAccess: new UntypedFormArray([]),
    }));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
