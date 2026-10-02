/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { Ref } from '../../model/ref';

import { BlogComponent } from './blog.component';

describe('BlogComponent', () => {
  let component: BlogComponent;
  let fixture: ComponentFixture<BlogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        forwardRef(() => BlogComponent),
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('computes columns immediately from changed inputs', () => {
    fixture.componentRef.setInput('ext', { tag: 'blog', config: { defaultCols: 2 } });
    expect(component.cols()).toBe(2);
    expect(component.colStyle()).toBe(' 1fr 1fr');
    fixture.componentRef.setInput('cols', 3);
    expect(component.colStyle()).toBe(' 1fr 1fr 1fr');
  });

  it('cancels stale pinned requests when the blog changes', async () => {
    const first = new Subject<Ref>();
    const second = new Subject<Ref>();
    vi.spyOn(component['refs'], 'getCurrent').mockImplementation(url => url === 'first:' ? first : second);
    fixture.componentRef.setInput('ext', { tag: 'first', config: { pinned: ['first:'] } });
    TestBed.tick();
    expect(first.observed).toBe(true);
    fixture.componentRef.setInput('ext', { tag: 'second', config: { pinned: ['second:'] } });
    TestBed.tick();
    expect(first.observed).toBe(false);
    second.next({ url: 'second:' });
    second.complete();
    await vi.waitFor(() => expect(component.pinned()).toEqual([{ url: 'second:' }]));
    fixture.componentRef.setInput('ext', { tag: 'empty' });
    TestBed.tick();
    await vi.waitFor(() => expect(component.pinned()).toEqual([]));
  });
});
