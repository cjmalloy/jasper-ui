/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { JasperFormlyModule } from '../../formly/formly.module';
import { PluginsFormComponent } from '../plugins/plugins.component';

import { RefFormComponent } from './ref.component';

describe('RefFormComponent', () => {
  let component: RefFormComponent;
  let fixture: ComponentFixture<RefFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        JasperFormlyModule,
        RefFormComponent
      ],
      providers: [
        PluginsFormComponent,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefFormComponent);
    component = fixture.componentInstance;
    component.group = new UntypedFormGroup({
      url: new UntypedFormControl(),
      published: new UntypedFormControl(),
      title: new UntypedFormControl(),
      comment: new UntypedFormControl(),
      sources: new UntypedFormControl(),
      alternateUrls: new UntypedFormControl(),
      tags: new UntypedFormControl(),
      plugins: new UntypedFormGroup({}),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
