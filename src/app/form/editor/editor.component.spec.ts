/// <reference types="vitest/globals" />
import { HttpEventType, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormArray, UntypedFormControl } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { firstValueFrom, Observable, of, Subject } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { ProxyService } from '../../service/api/proxy.service';
import { RefService } from '../../service/api/ref.service';

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
    plugins('plugin/code', 'plugin/file');
    fixture.componentRef.setInput('control', new UntypedFormControl());
    fixture.detectChanges();
  });

  function plugins(...tags: string[]) {
    vi.spyOn(TestBed.inject(AdminService), 'getPlugin').mockImplementation(tag => tags.includes(tag) ? { tag } as any : undefined);
  }

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

  describe('plugin gating', () => {
    let save: any;
    let create: any;
    const yaml = () => new File(['a: 1'], 'config.yml', { type: '' });
    const bin = () => new File(['x'], 'a.bin', { type: 'application/octet-stream' });
    const start = (file: File) => {
      const upload = { id: file.name, name: file.name, progress: 0 };
      component.uploads.set([upload]);
      return component.upload$(file, upload);
    };

    beforeEach(() => {
      save = vi.spyOn(TestBed.inject(ProxyService), 'save').mockReturnValue(new Subject());
      create = vi.spyOn(TestBed.inject(RefService), 'create').mockReturnValue(of('2024-01-01T00:00:00.000Z'));
    });

    it('uploads code inline when only plugin/code is installed', async () => {
      plugins('plugin/code');
      const ref = await firstValueFrom(start(yaml()));
      expect(save).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ comment: 'a: 1' }));
      expect(ref!.url).toMatch(/^internal:/);
      expect(ref!.tags).toContain('plugin/code/yaml');
      expect(await firstValueFrom(start(bin()))).toBeNull();
      expect(save).not.toHaveBeenCalled();
      expect(component.uploads()[0].error).toBe('File uploads not enabled');
    });

    it('caches code when only plugin/file is installed', () => {
      plugins('plugin/file');
      start(yaml()).subscribe();
      expect(save).toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it('uploads code inline and caches binaries when both plugins are installed', async () => {
      plugins('plugin/code', 'plugin/file');
      const ref = await firstValueFrom(start(yaml()));
      expect(ref!.tags).toContain('plugin/code/yaml');
      expect(save).not.toHaveBeenCalled();
      start(bin()).subscribe();
      expect(save).toHaveBeenCalled();
    });

    it('does not upload when neither plugin is installed', async () => {
      plugins();
      expect(await firstValueFrom(start(yaml()))).toBeNull();
      expect(save).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(component.uploads()[0].error).toBe('File uploads not enabled');
    });
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

  it('should scroll the fullscreen preview to the selected source position', () => {
    component.preview.set(true);
    component.control().setValue('# One\n\nTwo\n\nThree');
    fixture.detectChanges();
    component.fullscreen.set(true);
    expect(component.md()?.progressive()).toBe(true);

    const md = fixture.nativeElement.querySelector('app-md') as HTMLElement;
    const three = Array.from(md.querySelectorAll<HTMLElement>('[aria-posinset]'))
      .find(el => el.textContent === 'Three')!;
    expect(three).toBeTruthy();
    vi.spyOn(md, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect);
    vi.spyOn(three, 'getBoundingClientRect').mockReturnValue({ top: 900 } as DOMRect);
    Object.defineProperty(md, 'clientHeight', { value: 200 });

    (component as any).selectionStart = '# One\n\nTwo\n\nTh'.length;
    component.onSelectEditor();

    expect(md.scrollTop).toBe(800 - 100);
  });

  it('should reload preview iframes after moving into and out of fullscreen', () => {
    component.preview.set(true);
    component.control().setValue('One');
    fixture.detectChanges();
    const md = component.md()!;
    const reload = vi.spyOn(md, 'reloadIframes');
    component.editor()!.nativeElement.scrollIntoView = vi.fn();
    localStorage.setItem('showFullscreenPreview', 'true');
    localStorage.setItem('showPreview', 'true');

    component.toggleFullscreen(true);
    expect(reload).toHaveBeenCalledTimes(1);

    component.toggleFullscreen(false);
    expect(reload).toHaveBeenCalledTimes(2);
  });

});

@Component({
  selector: 'app-on-push-editor-host',
  template: `<app-editor [control]="control"></app-editor>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorComponent],
})
class OnPushEditorHost {
  control = new UntypedFormControl();
  readonly editor = viewChild.required(EditorComponent);
}

describe('EditorComponent in an OnPush host', () => {
  let fixture: ComponentFixture<OnPushEditorHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnPushEditorHost],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnPushEditorHost);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  it('should re-render the preview after converting HTML to markdown', async () => {
    vi.useFakeTimers();
    try {
      const editor = fixture.componentInstance.editor();
      editor.preview.set(true);
      const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = '<p>Hello <b>world</b></p>';
      textarea.dispatchEvent(new Event('input'));
      textarea.dispatchEvent(new Event('blur'));
      await vi.advanceTimersByTimeAsync(1000);
      expect(editor.md()?.text()).toBe('<p>Hello <b>world</b></p>');

      editor.fireEvent({ event: 'html-to-markdown' });
      await vi.advanceTimersByTimeAsync(1000);

      expect(textarea.value).toBe('Hello **world**');
      expect(editor.md()?.text()).toBe('Hello **world**');
    } finally {
      vi.useRealTimers();
    }
  });
});
