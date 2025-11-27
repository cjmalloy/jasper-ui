/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { Ref } from '../../../model/ref';

import { SubmitWebPage } from './web.component';

// Mock RefFormComponent to avoid circular dependency issues
@Component({
  selector: 'app-ref-form',
  template: '<div>Mock RefForm</div>',
  standalone: true,
})
class MockRefFormComponent {
  @Input() group?: UntypedFormGroup;
}

describe('SubmitWebPage', () => {
  let component: SubmitWebPage;
  let fixture: ComponentFixture<SubmitWebPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        SubmitWebPage,
      ],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    })
    .overrideComponent(SubmitWebPage, {
      set: {
        imports: [ReactiveFormsModule, MockRefFormComponent]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubmitWebPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
