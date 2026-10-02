/// <reference types="vitest/globals" />
import { HttpEventType, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormArray, UntypedFormControl } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';
import { ProxyService } from '../../service/api/proxy.service';

import { EditorComponent } from './editor.component';

describe('EditorComponent', () => {
  let component: EditorComponent;
  let fixture: ComponentFixture<EditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(EditorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('control', new UntypedFormControl());
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty uploads array', () => {
    expect(component.uploads()).toEqual([]);
  });

  it('should show the editor after clicking the add button', async () => {
    fixture.componentRef.setInput('addButton', true);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('textarea')).toBeTruthy();
  });

  it('should have hasActiveUploads method that returns false when no uploads', () => {
    expect(component.hasActiveUploads()).toBeFalsy();
  });

  it('should have hasActiveUploads method that returns true when active uploads exist', () => {
    component.uploads.set([
      { id: '1', name: 'test.pdf', progress: 50, completed: false },
      { id: '2', name: 'test2.jpg', progress: 100, completed: true }
    ]);
    expect(component.hasActiveUploads()).toBeTruthy();
  });

  it('should cancel individual upload correctly', () => {
    const unsubscribe = vi.fn();
    vi.spyOn(component, 'upload$').mockReturnValue(new Observable(() => unsubscribe));
    component.upload([new File([], 'test.pdf'), new File([], 'test2.jpg')] as any);
    const remaining = component.uploads()[1];

    component.cancelUpload(component.uploads()[0]);

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(component.uploads().length).toBe(1);
    expect(component.uploads()[0]).toBe(remaining);
  });

  it('should cancel all uploads correctly', () => {
    const unsubscribe = vi.fn();
    vi.spyOn(component, 'upload$').mockReturnValue(new Observable(() => unsubscribe));
    component.upload([new File([], 'test.pdf'), new File([], 'test2.jpg')] as any);

    component.cancelAllUploads();

    expect(unsubscribe).toHaveBeenCalledTimes(2);
    expect(component.uploads().length).toBe(0);
  });

  it('should append new uploads when there are active uploads', () => {
    // Setup existing uploads with one active
    component.uploads.set([
      { id: '1', name: 'existing.pdf', progress: 50, completed: false },
      { id: '2', name: 'completed.jpg', progress: 100, completed: true }
    ]);

    // Mock the upload$ method to avoid real HTTP requests
    vi.spyOn(component, 'upload$').mockReturnValue(of(null));

    // Mock file list for new upload
    const file1 = new File(['test'], 'new1.txt', { type: 'text/plain' });
    const file2 = new File(['test'], 'new2.txt', { type: 'text/plain' });
    const fileList = [file1, file2] as any as FileList;

    component.upload(fileList);

    // Should have 4 uploads total (2 existing + 2 new)
    expect(component.uploads().length).toBe(4);
    expect(component.uploads()[0].name).toBe('existing.pdf');
    expect(component.uploads()[1].name).toBe('completed.jpg');
    expect(component.uploads()[2].name).toBe('new1.txt');
    expect(component.uploads()[3].name).toBe('new2.txt');
  });

  it('should clear uploads when no active uploads exist', () => {
    // Setup existing uploads with all completed
    component.uploads.set([
      { id: '1', name: 'completed1.pdf', progress: 100, completed: true },
      { id: '2', name: 'completed2.jpg', progress: 100, completed: true }
    ]);

    // Mock the upload$ method to avoid real HTTP requests
    vi.spyOn(component, 'upload$').mockReturnValue(of(null));

    // Mock file list for new upload
    const file = new File(['test'], 'new.txt', { type: 'text/plain' });
    const fileList = [file] as any as FileList;

    component.upload(fileList);

    // Should have only 1 upload (the new one, previous completed ones cleared)
    expect(component.uploads().length).toBe(1);
    expect(component.uploads()[0].name).toBe('new.txt');
  });

  it('should attach all URLs at once when all uploads complete', () => {
    // Mock the attachUrls method to spy on its calls
    vi.spyOn(component, 'attachUrls');

    // Mock refs to return from upload$
    const ref1 = { url: 'url1', tags: [] } as any;
    const ref2 = { url: 'url2', tags: [] } as any;

    // Setup uploads
    component.uploads.set([
      { id: '1', name: 'file1.txt', progress: 100, completed: true, ref: ref1 },
      { id: '2', name: 'file2.txt', progress: 100, completed: true, ref: ref2 }
    ]);

    // Trigger completion check
    component.checkAllUploadsComplete();

    // Should call attachUrls once with both refs
    expect(component.attachUrls).toHaveBeenCalledWith(ref1, ref2);
    expect(component.attachUrls).toHaveBeenCalledTimes(1);
  });

  it('should enable textarea when canceling the last upload', () => {
    // Setup with one upload
    component.uploads.set([
      { id: '1', name: 'file1.txt', progress: 50, completed: false }
    ]);
    component.control().disable();

    // Cancel the upload
    component.cancelUpload(component.uploads()[0]);

    // Should enable the control since no uploads remain
    expect(component.control().enabled).toBeTruthy();
    expect(component.uploads().length).toBe(0);
  });

  it('should not enable textarea when canceling one of multiple uploads', () => {
    // Setup with multiple uploads
    component.uploads.set([
      { id: '1', name: 'file1.txt', progress: 50, completed: false },
      { id: '2', name: 'file2.txt', progress: 75, completed: false }
    ]);
    component.control().disable();

    // Cancel one upload
    component.cancelUpload(component.uploads()[0]);

    // Should remain disabled since there's still an active upload
    expect(component.control().disabled).toBeTruthy();
    expect(component.uploads().length).toBe(1);
  });

  it('updates upload progress without mutating previous snapshots', () => {
    const events = new Subject<any>();
    vi.spyOn(TestBed.inject(ProxyService), 'save').mockReturnValue(events);
    component.upload([new File([], 'test.bin', { type: 'application/octet-stream' })] as any);
    const previous = component.uploads();
    Object.freeze(previous[0]);

    events.next({ type: HttpEventType.UploadProgress, loaded: 3, total: 4 });

    expect(previous[0].progress).toBe(0);
    expect(component.uploads()[0].progress).toBe(75);
    expect(component.uploads()[0]).not.toBe(previous[0]);
    component.cancelAllUploads();
  });

  it('records upload failures without mutating previous snapshots', () => {
    const events = new Subject<any>();
    vi.spyOn(TestBed.inject(ProxyService), 'save').mockReturnValue(events);
    component.upload([new File([], 'test.bin', { type: 'application/octet-stream' })] as any);
    const previous = component.uploads()[0];
    Object.freeze(previous);

    events.error(new Error('Upload rejected'));

    expect(previous.error).toBeUndefined();
    expect(component.uploads()[0].error).toBe('Upload rejected');
    expect(component.uploads()[0].progress).toBe(0);
    component.cancelAllUploads();
  });

  it('updates completion immutably and does not retain synchronous subscriptions', () => {
    const ref = { url: 'internal:test', tags: [] } as any;
    const result = new Subject<any>();
    vi.spyOn(component, 'upload$').mockReturnValue(result);
    vi.spyOn(component, 'attachUrls').mockImplementation(() => undefined);
    component.upload([new File([], 'test.txt')] as any);
    const previous = component.uploads()[0];
    Object.freeze(previous);

    result.next(ref);

    expect(previous.completed).toBeUndefined();
    expect(component.attachUrls).toHaveBeenCalledWith(ref);
    expect(component.uploads()).toEqual([]);
    result.complete();

    const synchronous = of(ref);
    const unsubscribe = vi.spyOn(synchronous, 'subscribe');
    vi.mocked(component.upload$).mockReturnValue(synchronous);
    component.upload([new File([], 'next.txt')] as any);
    expect(unsubscribe.mock.results[0].value.closed).toBe(true);
    expect((component as any).uploadSubscriptions.size).toBe(0);
  });

  it('cancels outstanding uploads on destruction', () => {
    const unsubscribe = vi.fn();
    vi.spyOn(component, 'upload$').mockReturnValue(new Observable(() => unsubscribe));
    component.upload([new File([], 'test.pdf')] as any);
    fixture.destroy();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('derives response selection from tags and allows manual selection', () => {
    vi.spyOn(component.admin, 'responseButton').mockReturnValue([
      { tag: 'response/one' }, { tag: 'response/two' },
    ] as any);
    const tags = new UntypedFormArray([new UntypedFormControl('response/two')]);
    fixture.componentRef.setInput('selectResponseType', true);
    fixture.componentRef.setInput('tags', tags);
    fixture.detectChanges();
    expect(component.toggleIndex()).toBe(1);
    component.toggleIndex.set(0);
    expect(component.responseTags()).toEqual(['response/one']);
    tags.setValue(['response/one']);
    expect(component.toggleIndex()).toBe(0);
    tags.setValue(['response/two']);
    expect(component.toggleIndex()).toBe(1);
  });

  it('preserves independent loading events when scraping changes', () => {
    component.loadingEvents.update(events => ({ ...events, independent: true }));
    fixture.componentRef.setInput('scraping', true);
    expect(component.loadingEvents()).toEqual({ independent: true, 'scrape-done': true });
    fixture.componentRef.setInput('scraping', false);
    expect(component.loadingEvents()).toEqual({ independent: true, 'scrape-done': false });
  });
});
