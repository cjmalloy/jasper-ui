/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';

import { CommentReplyComponent } from './comment-reply.component';

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

describe('CommentReplyComponent', () => {
  let component: CommentReplyComponent;
  let fixture: ComponentFixture<CommentReplyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommentReplyComponent],
      providers: [
        { provide: AdminService, useValue: {
            getPlugin: () => null,
            getEditorButtons: () => []
          }
        },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    })
    .overrideComponent(CommentReplyComponent, {
      set: {
        imports: [MockEditorComponent]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommentReplyComponent);
    component = fixture.componentInstance;
    component.to = { url: '' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
