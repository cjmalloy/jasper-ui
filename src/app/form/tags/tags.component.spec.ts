/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { provideJasperFormly } from '../../formly/formly.config';

import { TagsFormComponent } from './tags.component';

describe('TagsFormComponent', () => {
  let component: TagsFormComponent;
  let fixture: ComponentFixture<TagsFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        TagsFormComponent
      ],
      providers: [
        provideJasperFormly(),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TagsFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('group', new UntypedFormGroup({ tags: new UntypedFormControl({}) }));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
