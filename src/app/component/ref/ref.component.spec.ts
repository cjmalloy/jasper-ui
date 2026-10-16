/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { SafePipe } from '../../pipe/safe.pipe';

import { RefComponent } from './ref.component';

describe('RefComponent', () => {
  let component: RefComponent;
  let fixture: ComponentFixture<RefComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        forwardRef(() => RefComponent),
        ReactiveFormsModule,
        SafePipe,
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('ref', { url: '' });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('derives titles from new refs and form edits', () => {
    fixture.componentRef.setInput('ref', { url: 'https://example.com', title: 'First' });
    fixture.detectChanges();
    expect(component.title()).toBe('First');
    fixture.componentRef.setInput('ref', { url: 'https://example.org', title: 'Second' });
    fixture.detectChanges();
    expect(component.title()).toBe('Second');
    component.setEditing(true);
    component.editForm.get('title')!.setValue('Edited');
    expect(component.title()).toBe('Edited');
  });

  it('cancels stale tag preview requests when the Ref changes', () => {
    const first = new Subject<any[]>();
    const second = new Subject<any[]>();
    vi.spyOn((component as any).editor, 'getTagsPreview')
      .mockReturnValueOnce(first.asObservable())
      .mockReturnValueOnce(second.asObservable());
    fixture.componentRef.setInput('ref', { url: 'https://example.com', tags: ['alpha'] });
    fixture.detectChanges();
    expect(first.observed).toBe(true);
    fixture.componentRef.setInput('ref', { url: 'https://example.org', tags: ['beta'] });
    fixture.detectChanges();
    expect(first.observed).toBe(false);
    second.next([{ tag: 'beta', name: 'Beta' }]);
    expect(component.tagExts()).toEqual([{ tag: 'beta', name: 'Beta' }]);
  });

  it('keeps the disabled Ref URL in thumbnail data while editing', () => {
    fixture.componentRef.setInput('ref', { url: 'cache:image-id', origin: '' });
    fixture.detectChanges();
    component.editForm.get('url')!.setValue(component.ref().url);
    component.setEditing(true);

    expect(component.thumbnailRefs()[0]?.url).toBe('cache:image-id');
  });

  it('keeps storyboard data from the Ref while editing', () => {
    const storyboard = { url: 'https://example.com/sb.jpg', width: 160, height: 90, rows: 2, cols: 2 };
    vi.spyOn(component.admin, 'getPlugin').mockReturnValue({ tag: 'plugin/thumbnail/storyboard' } as any);
    fixture.componentRef.setInput('ref', {
      url: 'https://example.com',
      origin: '',
      tags: ['plugin/thumbnail/storyboard'],
      plugins: { 'plugin/thumbnail/storyboard': storyboard },
    });
    fixture.detectChanges();
    component.setEditing(true);
    const tags = component.editForm.get('tags') as any;
    tags.push(new FormControl('plugin/thumbnail/storyboard'));
    component.storyboardLoaded.set(true);

    expect(component.storyboardData()).toEqual(storyboard);
    expect(component.storyboardUrl()).toBe('url("https://example.com/sb.jpg")');
    expect(component.storyboardReady()).toBe(true);
  });

  it('is not storyboard ready without a storyboard url', () => {
    component.storyboardLoaded.set(true);

    expect(component.storyboardReady()).toBe(false);
  });

  it('styles Refs from an account alias as sent', () => {
    const store = component.store;
    store.account.tag.set('+user/dad');
    store.account.origin.set('');
    store.origins.accountAliases.set([{ from: '', origin: '@city', local: '+user/dad', remote: '+user/chris' }]);

    fixture.componentRef.setInput('ref', { url: 'comment:1', origin: '@city', tags: ['+user/chris'] });
    expect(component.sent()).toBe(true);
    expect(component.isAuthor()).toBe(false);

    fixture.componentRef.setInput('ref', { url: 'comment:2', origin: '@city', tags: ['+user/bob'] });
    expect(component.sent()).toBe(false);

    fixture.componentRef.setInput('ref', { url: 'comment:3', origin: '', tags: ['+user/dad'] });
    expect(component.sent()).toBe(true);
  });

  it('preserves protected and private plugin tags when copying', () => {
    fixture.componentRef.setInput('ref', {
      url: 'https://example.com',
      origin: '@remote',
      tags: ['public', '+restricted', '_private', '+plugin/secret', '_plugin/cache'],
      plugins: {
        '+plugin/secret': { value: 'secret' },
        '_plugin/cache': { value: 'cached' },
      },
    });
    fixture.detectChanges();
    const refs = (component as any).refs;
    const auth = (component as any).auth;
    vi.spyOn(auth, 'canAddTag').mockReturnValue(true);
    const create = vi.spyOn(refs, 'create').mockReturnValue(of(component.ref()));

    component.copy$();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      tags: ['public', '+plugin/secret', '_plugin/cache'],
      plugins: {
        '+plugin/secret': { value: 'secret' },
        '_plugin/cache': { value: 'cached' },
      },
    }));
  });
});
