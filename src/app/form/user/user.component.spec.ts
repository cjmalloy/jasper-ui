import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormArray, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { JasperFormlyModule } from '../../formly/formly.module';

import { UserFormComponent } from './user.component';

describe('UserFormComponent', () => {
  let component: UserFormComponent;
  let fixture: ComponentFixture<UserFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        forwardRef(() => UserFormComponent),
        ReactiveFormsModule,
        JasperFormlyModule,
      ],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(UserFormComponent);
    component = fixture.componentInstance;
    component.group = new UntypedFormGroup({
      tag: new UntypedFormControl(),
      name: new UntypedFormControl(),
      role: new UntypedFormControl(),
      pubKey: new UntypedFormControl(),
      authorizedKeys: new UntypedFormControl(),
      readAccess: new UntypedFormArray([]),
      writeAccess: new UntypedFormArray([]),
      tagReadAccess: new UntypedFormArray([]),
      tagWriteAccess: new UntypedFormArray([]),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
