/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SafePipe } from '../../pipe/safe.pipe';
import { MemoCache } from '../../util/memo';

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
    component.ref = { url: '' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the disabled Ref URL in thumbnail data while editing', () => {
    component.ref = { url: 'cache:image-id', origin: '' };
    component.editForm.get('url')!.setValue(component.ref.url);
    (component as any)._editing = true;

    expect(component.thumbnailRefs[0]?.url).toBe('cache:image-id');
  });

  it('keeps storyboard data from the Ref while editing', () => {
    const storyboard = { url: 'https://example.com/sb.jpg', width: 160, height: 90, rows: 2, cols: 2 };
    vi.spyOn(component.admin, 'getPlugin').mockReturnValue({ tag: 'plugin/thumbnail/storyboard' } as any);
    component.ref = {
      url: 'https://example.com',
      origin: '',
      tags: ['plugin/thumbnail/storyboard'],
      plugins: { 'plugin/thumbnail/storyboard': storyboard },
    };
    const tags = component.editForm.get('tags') as any;
    tags.push(new FormControl('plugin/thumbnail/storyboard'));
    (component as any)._editing = true;
    component.storyboardLoaded = true;
    MemoCache.clear(component);

    expect(component.storyboardData).toEqual(storyboard);
    expect(component.storyboardUrl).toBe('url("https://example.com/sb.jpg")');
    expect(component.storyboardReady).toBe(true);
  });

  it('is not storyboard ready without a storyboard url', () => {
    component.storyboardLoaded = true;
    MemoCache.clear(component);

    expect(component.storyboardReady).toBe(false);
  });

  it('styles Refs from an account alias as sent', () => {
    const store = component.store;
    store.account.tag = '+user/dad';
    store.account.origin = '';
    store.origins.accountAliases = [{ from: '', origin: '@city', local: '+user/dad', remote: '+user/chris' }];

    MemoCache.clear(component);
    component.ref = { url: 'comment:1', origin: '@city', tags: ['+user/chris'] };
    expect(component.sent).toBe(true);
    expect(component.isAuthor).toBe(false);

    MemoCache.clear(component);
    component.ref = { url: 'comment:2', origin: '@city', tags: ['+user/bob'] };
    expect(component.sent).toBe(false);

    MemoCache.clear(component);
    component.ref = { url: 'comment:3', origin: '', tags: ['+user/dad'] };
    expect(component.sent).toBe(true);
  });

  it('preserves protected and private plugin tags when copying', () => {
    component.ref = {
      url: 'https://example.com',
      origin: '@remote',
      tags: ['public', '+restricted', '_private', '+plugin/secret', '_plugin/cache'],
      plugins: {
        '+plugin/secret': { value: 'secret' },
        '_plugin/cache': { value: 'cached' },
      },
    };
    const refs = (component as any).refs;
    const auth = (component as any).auth;
    vi.spyOn(auth, 'canAddTag').mockReturnValue(true);
    const create = vi.spyOn(refs, 'create').mockReturnValue(of(component.ref));

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
