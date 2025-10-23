/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { JasperFormlyModule } from '../../../formly/formly.module';

import { GenFormComponent } from './gen.component';

describe('GenComponent', () => {
  let component: GenFormComponent;
  let fixture: ComponentFixture<GenFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        JasperFormlyModule,
        GenFormComponent,
      ],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GenFormComponent);
    component = fixture.componentInstance;
    component.plugin = {
      tag: 'plugin/test',
      config: {
        form: [],
      }
    };
    component.plugins = new UntypedFormGroup({
      'plugin/test': new UntypedFormGroup({}),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
