/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

import { CommentThreadComponent } from './comment-thread.component';

describe('CommentThreadComponent', () => {
  let component: CommentThreadComponent;
  let fixture: ComponentFixture<CommentThreadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => CommentThreadComponent)],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentThreadComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('newComments$', new Subject());
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not pad a short cached thread with undefined comments', () => {
    fixture.componentRef.setInput('source', 'comment:parent');
    fixture.componentRef.setInput('pageSize', 5);
    component.thread.add({ url: 'comment:child', sources: ['comment:parent'] });
    expect(component.comments()).toEqual([{ url: 'comment:child', sources: ['comment:parent'] }]);
  });

  it('resets local replies when the source changes', () => {
    component.newComments.set([{ url: 'comment:child' }]);
    fixture.componentRef.setInput('source', 'comment:other');
    expect(component.newComments()).toEqual([]);
    expect(component.saveChanges()).toBe(true);
  });
});
