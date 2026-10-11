/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { Subject } from 'rxjs';
import { Ref } from '../../../model/ref';
import { RefService } from '../../../service/api/ref.service';

import { ChatEntryComponent } from './chat-entry.component';

describe('ChatEntryComponent', () => {
  let component: ChatEntryComponent;
  let fixture: ComponentFixture<ChatEntryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        forwardRef(() => ChatEntryComponent),
        MarkdownModule.forRoot(),
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatEntryComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('ref', {url: ''});
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('recomputes derived content and resets message UI when the input changes', () => {
    fixture.componentRef.setInput('ref', { url: 'https://example.com/first', title: ' First ', comment: 'comment' });
    fixture.detectChanges();
    expect(component.title()).toBe('First');
    expect(component.noComment().comment).toBe('');
    component.deleted.set(true);
    component.serverError.set(['previous error']);

    fixture.componentRef.setInput('ref', { url: 'tag:/second', title: 'Second', comment: 'new comment' });
    fixture.detectChanges();

    expect(component.title()).toBe('Second');
    expect(component.tagLink()).toBe(true);
    expect(component.noComment().url).toBe('tag:/second');
    expect(component.noComment().comment).toBe('');
    expect(component.ref().comment).toBe('new comment');
    expect(component.deleted()).toBe(false);
    expect(component.serverError()).toEqual([]);
  });

  it('recomputes derived content after a local ref update', () => {
    expect(component.tagLink()).toBe(false);
    component.ref.set({ url: 'tag:/updated', title: 'Updated' });

    expect(component.tagLink()).toBe(true);
    expect(component.title()).toBe('Updated');
    expect(component.noComment().url).toBe('tag:/updated');
  });

  it('cancels an outdated repost lookup when the entry changes', () => {
    const first = new Subject<Ref>();
    const second = new Subject<Ref>();
    const getCurrent = vi.spyOn(TestBed.inject(RefService), 'getCurrent')
      .mockReturnValueOnce(first).mockReturnValueOnce(second);
    fixture.componentRef.setInput('ref', {
      url: 'comment:first', sources: ['https://example.com/first'], tags: ['plugin/repost'],
    });
    fixture.detectChanges();
    TestBed.tick();
    expect(first.observed).toBe(true);

    fixture.componentRef.setInput('ref', {
      url: 'comment:second', sources: ['https://example.com/second'], tags: ['plugin/repost'],
    });
    fixture.detectChanges();
    TestBed.tick();
    expect(first.observed).toBe(false);
    expect(second.observed).toBe(true);
    expect(getCurrent).toHaveBeenLastCalledWith('https://example.com/second');

    second.next({ url: 'https://example.com/second', title: 'Second', comment: 'repost comment' });
    expect(component.title()).toBe('Second');
    expect(component.noComment().url).toBe('https://example.com/second');
    expect(component.noComment().comment).toBe('');

    fixture.componentRef.setInput('ref', { url: 'comment:plain', comment: 'plain comment' });
    fixture.detectChanges();
    TestBed.tick();
    expect(second.observed).toBe(false);
    expect(component.repostRef()).toBeUndefined();
    expect(component.noComment().url).toBe('comment:plain');
  });
});
