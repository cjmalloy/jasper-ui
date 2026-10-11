/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';

import { CommentComponent } from './comment.component';

describe('CommentComponent', () => {
  let component: CommentComponent;
  let fixture: ComponentFixture<CommentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => CommentComponent), MarkdownModule.forRoot()],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CommentComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('ref', { url: '' });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('updates comment counts and deletion state without imperative init', () => {
    expect(component.comments()).toBe(0);
    expect(component.deleted()).toBe(false);
    component.ref.set({
      url: 'comment:updated',
      tags: ['plugin/delete'],
      metadata: { plugins: { 'plugin/comment': 3 } },
    });
    expect(component.comments()).toBe(3);
    expect(component.deleted()).toBe(true);
    expect(component.moreComments()).toBe(true);
  });
});
