/// <reference types="vitest/globals" />
import { HttpEventType, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of, Subject } from 'rxjs';
import { AdminService } from '../../service/admin.service';
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
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    plugins('plugin/code', 'plugin/file');
    fixture.detectChanges();
  });

  function plugins(...tags: string[]) {
    vi.spyOn(TestBed.inject(AdminService), 'getPlugin').mockImplementation(tag => tags.includes(tag) ? { tag } as any : undefined);
  }

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

    const items = (file: File) => [{ kind: 'file', getAsFile: () => file }];

    it('uploads pasted code when only plugin/code is installed', async () => {
      plugins('plugin/code');
      const event = { clipboardData: { items: items(yaml()) }, preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
      component.handlePaste(event);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ comment: 'a: 1', tags: expect.arrayContaining(['plugin/code/yaml']) })));
    });

    it('uploads dropped code when only plugin/code is installed', async () => {
      plugins('plugin/code');
      const event = { dataTransfer: { items: items(yaml()), getData: () => '' }, preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
      component.handleDrop(event);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ comment: 'a: 1', tags: expect.arrayContaining(['plugin/code/yaml']) })));
    });

    it('ignores pasted files when neither plugin is installed', () => {
      plugins();
      const event = { clipboardData: { items: items(yaml()) }, preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
      component.handlePaste(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(component.uploads()).toEqual([]);
    });
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

  it('should upload as public when public is toggled', async () => {
    const refs = TestBed.inject(RefService);
    const create = vi.spyOn(refs, 'create').mockReturnValue(of('2024-01-01T00:00:00Z'));
    component.tags.set(['public']);
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const ref = await firstValueFrom(component.upload$(file, { id: '1', name: 'test.txt', progress: 0 }));
    expect(create.mock.calls[0][0].tags).toContain('public');
    expect(ref?.tags).toContain('public');
  });

  it('should upload as private when public is not toggled', async () => {
    const refs = TestBed.inject(RefService);
    const create = vi.spyOn(refs, 'create').mockReturnValue(of('2024-01-01T00:00:00Z'));
    component.tags.set([]);
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    await firstValueFrom(component.upload$(file, { id: '1', name: 'test.txt', progress: 0 }));
    expect(create.mock.calls[0][0].tags).not.toContain('public');
  });
});
