/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { Subject } from 'rxjs';
import { ThreadStore } from '../../../store/thread';

import { CommentThreadComponent } from './comment-thread.component';

describe('CommentThreadComponent', () => {
  let component: CommentThreadComponent;
  let fixture: ComponentFixture<CommentThreadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        forwardRef(() => CommentThreadComponent),
        MarkdownModule.forRoot(),
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentThreadComponent);
    component = fixture.componentInstance;
    component.newComments$ = new Subject();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads cached children and reacts to later cache updates', () => {
    const thread = TestBed.inject(ThreadStore);
    const first = { url: 'first', origin: '', sources: ['parent'] };
    const second = { url: 'second', origin: '', sources: ['parent'] };

    thread.add(first);
    fixture.componentRef.setInput('source', 'parent');
    fixture.detectChanges();
    expect(component.comments).toEqual([first]);
    expect(fixture.nativeElement.querySelectorAll('.comment')).toHaveLength(1);

    thread.add(second);
    fixture.detectChanges();
    expect(component.comments).toEqual([first, second]);
    expect(fixture.nativeElement.querySelectorAll('.comment')).toHaveLength(2);
  });

  it('does not pad a page-sized cache with empty comments', () => {
    const thread = TestBed.inject(ThreadStore);
    thread.add({ url: 'first', origin: '', sources: ['parent'] });

    fixture.componentRef.setInput('source', 'parent');
    fixture.componentRef.setInput('pageSize', 5);
    fixture.detectChanges();

    expect(component.comments).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.comment')).toHaveLength(1);
  });
});
