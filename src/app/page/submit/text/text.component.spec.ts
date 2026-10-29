/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { TagsFormComponent } from '../../../form/tags/tags.component';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { provideJasperFormly } from '../../../formly/formly.config';
import { Store } from '../../../store/store';

import { SubmitTextPage } from './text.component';

describe('SubmitTextPage', () => {
  let component: SubmitTextPage;
  let fixture: ComponentFixture<SubmitTextPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        SubmitTextPage,
        TagsFormComponent
      ],
      providers: [
        provideJasperFormly(),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmitTextPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('adds completed uploads without mutating the previous snapshot', () => {
    const previous = component.completedUploads();
    const ref = { url: 'cache:uploaded' };

    component.addCompletedUpload(ref);

    expect(previous).toEqual([]);
    expect(component.completedUploads()).toEqual([ref]);
    expect(component.completedUploads()).not.toBe(previous);
  });

  it('should initialize a generated url for text posts', () => {
    expect(component.url.value).toMatch(/^comment:/);
  });

  it('should regenerate a missing url before writing a ref', () => {
    component.url.setValue('');

    const ref = component.writeRef();

    expect(ref.url).toMatch(/^comment:/);
    expect(ref.url).toBe(component['generatedUrl']);
    expect(component.url.value).toBe(ref.url);
  });

  it('should prefer the route url over the existing control value', () => {
    component.url.setValue('comment:local');
    vi.spyOn(TestBed.inject(Store).submit, 'url').mockReturnValue('comment:route');

    const ref = component.writeRef();

    expect(ref.url).toBe('comment:route');
    expect(component.url.value).toBe('comment:route');
  });

  it('should not keep a bare wiki prefix as the url', () => {
    component.url.setValue('');
    vi.spyOn(TestBed.inject(Store).submit, 'url').mockReturnValue('wiki:');
    vi.spyOn(TestBed.inject(Store).submit, 'wiki').mockReturnValue(true);
    vi.spyOn(component.admin, 'getWikiPrefix').mockReturnValue('wiki:');

    const ref = component.writeRef();

    expect(ref.url).toMatch(/^wiki:.+/);
    expect(ref.url).not.toBe('wiki:');
    expect(component.url.value).toBe(ref.url);
  });

  it('should share an in-flight draft save with the navigation guard', async () => {
    vi.spyOn(component.admin, 'editing').mockReturnValue({ tag: 'plugin/editing' });
    const first = new Subject<string>();
    const second = new Subject<string>();
    const saveEdit = vi.spyOn(TestBed.inject(RefService), 'saveEdit')
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    component.title.setValue('first');
    component.textForm.markAsDirty();

    component.saveForLater();
    const guard = component.saveChanges();
    component.title.setValue('second');
    first.next('cursor1');
    first.complete();

    await vi.waitFor(() => expect(saveEdit).toHaveBeenCalledTimes(2));
    expect(saveEdit.mock.calls[0][1]).toBeUndefined();
    expect(saveEdit.mock.calls[1][0].title).toBe('second');
    expect(saveEdit.mock.calls[1][1]).toBe('cursor1');
    second.next('cursor2');
    second.complete();

    expect(await guard).toBe(true);
    expect(component.saving()).toBe(false);
    expect(component.textForm.dirty).toBe(false);
  });

  describe('autosave', () => {
    let editor: SubmitTextPage;
    let editorFixture: ComponentFixture<SubmitTextPage>;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(TestBed.inject(AdminService), 'editing').mockReturnValue({ tag: 'plugin/editing' });
      editorFixture = TestBed.createComponent(SubmitTextPage);
      editor = editorFixture.componentInstance;
      editorFixture.detectChanges();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('makes one save per timer tick', async () => {
      const first = new Subject<string>();
      const second = new Subject<string>();
      const saveEdit = vi.spyOn(TestBed.inject(RefService), 'saveEdit')
        .mockReturnValueOnce(first)
        .mockReturnValueOnce(second);
      editor.title.setValue('first');
      editor.textForm.markAsDirty();

      await vi.advanceTimersByTimeAsync(5_000);
      expect(saveEdit).toHaveBeenCalledTimes(1);
      editor.title.setValue('second');
      await vi.advanceTimersByTimeAsync(5_000);
      expect(saveEdit).toHaveBeenCalledTimes(1);
      first.next('cursor1');
      first.complete();
      await vi.advanceTimersByTimeAsync(0);
      expect(saveEdit).toHaveBeenCalledTimes(1);
      expect(editor.textForm.dirty).toBe(true);

      await vi.advanceTimersByTimeAsync(5_000);
      expect(saveEdit).toHaveBeenCalledTimes(2);
      expect(saveEdit.mock.calls[1][0].title).toBe('second');
      expect(saveEdit.mock.calls[1][1]).toBe('cursor1');
      second.next('cursor2');
      second.complete();
      await vi.advanceTimersByTimeAsync(0);
      expect(editor.textForm.dirty).toBe(false);
    });

    it('saves again after picking a plugin following an autosave', async () => {
      const saveEdit = vi.spyOn(TestBed.inject(RefService), 'saveEdit')
        .mockReturnValueOnce(of('cursor1'))
        .mockReturnValueOnce(of('cursor2'));
      TestBed.tick();
      expect(editor.textForm.dirty).toBe(false);
      editor.title.setValue('draft');
      editor.textForm.markAsDirty();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(saveEdit).toHaveBeenCalledTimes(1);
      expect(editor.textForm.dirty).toBe(false);

      editor.store.view.route.routeSnapshot.set({ queryParams: { tag: 'plugin/todo' } } as any);
      TestBed.tick();
      expect(editor.textForm.dirty).toBe(true);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(saveEdit).toHaveBeenCalledTimes(2);
      expect(saveEdit.mock.calls[1][0].tags).toContain('plugin/todo');
    });
  });
});
