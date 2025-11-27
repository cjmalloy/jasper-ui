/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { Ref } from '../../../model/ref';

import { SubmitDmPage } from './dm.component';

// Mock EditorComponent to avoid circular dependency issues
@Component({
  selector: 'app-form-editor',
  template: '<div>Mock Editor</div>',
  standalone: true,
})
class MockEditorComponent {
  @Input() text?: string;
  @Input() ref?: Ref;
}

describe('SubmitDmPage', () => {
  let component: SubmitDmPage;
  let fixture: ComponentFixture<SubmitDmPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        SubmitDmPage
      ],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    })
    .overrideComponent(SubmitDmPage, {
      set: {
        imports: [ReactiveFormsModule, MockEditorComponent]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubmitDmPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
