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
      imports: [
        forwardRef(() => CommentComponent),
        MarkdownModule.forRoot(),
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CommentComponent);
    component = fixture.componentInstance;
    component.ref = { url: '' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('recomputes whether more comments remain after cache updates', () => {
    component.ref = {
      url: 'parent',
      metadata: { plugins: { 'plugin/comment': 1 } },
    };
    component.init();
    expect(component.moreComments).toBe(true);

    component.thread.add({ url: 'child', origin: '', sources: ['parent'] });

    expect(component.moreComments).toBe(false);
  });

  it('does not double-count new comments that arrive in the cache', () => {
    component.ref = {
      url: 'parent',
      metadata: { plugins: { 'plugin/comment': 20 } },
    };
    component.init();
    const reply = { url: 'reply', origin: '', sources: ['parent'] };
    component.newComments$.next(reply);
    for (let i = 0; i < 19; i++) {
      component.thread.add({ url: `child-${i}`, origin: '', sources: ['parent'] });
    }
    component.thread.add(reply);

    expect(component.moreComments).toBe(true);

    component.thread.add({ url: 'last-child', origin: '', sources: ['parent'] });

    expect(component.moreComments).toBe(false);
  });
});
