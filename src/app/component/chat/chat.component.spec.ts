/// <reference types="vitest/globals" />
import { HttpEventType, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { Subject } from 'rxjs';
import { ProxyService } from '../../service/api/proxy.service';
import { RefService } from '../../service/api/ref.service';

import { ChatComponent } from './chat.component';

describe('ChatComponent', () => {
  let component: ChatComponent;
  let fixture: ComponentFixture<ChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        forwardRef(() => ChatComponent),
        MarkdownModule.forRoot(),
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('updates upload progress without mutating existing signal snapshots', () => {
    const upload = Object.freeze({ id: 'upload', name: 'image.png', progress: 0 });
    component.uploads.set([upload]);
    const snapshot = component.uploads();
    const events = new Subject<any>();
    vi.spyOn(TestBed.inject(ProxyService), 'save').mockReturnValue(events);
    const subscription = component.upload$(new File(['image'], 'image.png', { type: 'image/png' }), upload).subscribe();

    events.next({ type: HttpEventType.UploadProgress, loaded: 1, total: 2 });

    expect(snapshot[0].progress).toBe(0);
    expect(component.uploads()[0]).toEqual({ ...upload, progress: 50 });
    expect(component.uploads()).not.toBe(snapshot);
    expect(component.hasActiveUploads()).toBe(true);
    component.updateUpload(upload.id, { error: 'Upload failed', progress: 0 });
    expect(component.hasActiveUploads()).toBe(false);
    subscription.unsubscribe();
  });

  it('cancels uploads using the current id even after immutable progress updates', () => {
    const events = new Subject<any>();
    vi.spyOn(TestBed.inject(ProxyService), 'save').mockReturnValue(events);
    component.upload([new File(['image'], 'image.png', { type: 'image/png' })]);
    const upload = component.uploads()[0];
    events.next({ type: HttpEventType.UploadProgress, loaded: 1, total: 2 });

    component.cancelUpload(upload);

    expect(events.observed).toBe(false);
    expect(component.uploads()).toEqual([]);
    expect(component.hasActiveUploads()).toBe(false);
    expect(upload.progress).toBe(0);
  });

  it('resets input-dependent UI and cancels requests when changing chat rooms', () => {
    const page = new Subject<any>();
    vi.spyOn(TestBed.inject(RefService), 'page').mockReturnValue(page);
    fixture.componentRef.setInput('query', 'first');
    fixture.detectChanges();
    expect(page.observed).toBe(true);
    component.addText.set('draft');
    component.tags.set(['plugin/test']);
    component.notAtBottom.set(true);
    const nextPage = new Subject<any>();
    vi.mocked(TestBed.inject(RefService).page).mockReturnValue(nextPage);

    fixture.componentRef.setInput('query', 'second');
    fixture.detectChanges();

    expect(page.observed).toBe(false);
    expect(nextPage.observed).toBe(true);
    expect(component.addText()).toBe('');
    expect(component.tags()).not.toContain('plugin/test');
    expect(component.notAtBottom()).toBe(false);
    expect(component.messages()).toBeUndefined();
  });
});
