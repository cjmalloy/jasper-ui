/// <reference types="vitest/globals" />
import { HttpErrorResponse, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { LinksFormComponent } from '../../../form/links/links.component';
import { RefFormComponent } from '../../../form/ref/ref.component';
import { TagsFormComponent } from '../../../form/tags/tags.component';
import { provideJasperFormly } from '../../../formly/formly.config';
import { feedPlugin } from '../../../mods/sync/feed';
import { AdminService } from '../../../service/admin.service';

import { SubmitWebPage } from './web.component';

describe('SubmitWebPage', () => {
  let component: SubmitWebPage;
  let fixture: ComponentFixture<SubmitWebPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        SubmitWebPage,
        RefFormComponent,
        TagsFormComponent,
        LinksFormComponent,
      ],
      providers: [
        provideJasperFormly(),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmitWebPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('converts an already existing ref into a repost before resubmitting', async () => {
    component.url = 'https://example.com';
    await new Promise(resolve => setTimeout(resolve, 10));
    vi.spyOn(component.webForm, 'valid', 'get').mockReturnValue(true);
    vi.spyOn(component, 'syncEditor').mockImplementation(() => {});
    vi.spyOn(component, 'writeRef').mockReturnValue({ tags: [] } as any);
    vi.spyOn(component['refs'], 'create').mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { detail: 'Already exists' },
    })));

    component.submit();

    expect(component.alreadyExists()).toBe(true);
    expect(component.serverError()).toEqual(['Already exists']);

    const addTag = vi.spyOn(component, 'addTag');
    const setLinks = vi.spyOn(component.refForm.sourcesFormComponent(), 'setLinks');
    component.prepareRepost();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(component.url).toMatch(/^internal:/);
    expect(addTag).toHaveBeenCalledWith('plugin/repost');
    expect(setLinks).toHaveBeenCalledWith(['https://example.com']);
    expect(component.alreadyExists()).toBe(false);
    expect(component.submitted()).toBe(false);
  });

  it('does not offer a repost when publishing a draft conflicts', async () => {
    component.url = 'https://example.com';
    await new Promise(resolve => setTimeout(resolve, 10));
    component['cursor'] = '2026-01-01T00:00:00Z';
    vi.spyOn(component.webForm, 'valid', 'get').mockReturnValue(true);
    vi.spyOn(component, 'syncEditor').mockImplementation(() => {});
    vi.spyOn(component, 'writeRef').mockReturnValue({ tags: [] } as any);
    vi.spyOn(component['refs'], 'update').mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { detail: 'Ref already modified' },
    })));

    component.submit();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(component.alreadyExists()).toBe(false);
    expect(component.submitting()).toBe(false);
    expect(component.serverError()).toEqual(['Ref already modified']);
  });

  it('only fills the feed default thumbnail until it is overridden', async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    component.addTag('plugin/script/feed');
    const plugins = component.webForm.get('plugins') as FormGroup;
    if (!plugins.get('plugin/script/feed')) plugins.addControl('plugin/script/feed', new FormGroup({}));
    const feed = plugins.get('plugin/script/feed') as FormGroup;
    if (!feed.get('defaultThumbnail')) feed.addControl('defaultThumbnail', new FormGroup({ url: new FormControl(''), radius: new FormControl(0) }));
    const url = feed.get(['defaultThumbnail', 'url'])!;
    const thumbnail = { url: 'https://blog.example/icon.png', radius: 4 };

    const filled = component['feedDefaultThumbnail']({ 'plugin/thumbnail': thumbnail })['plugin/script/feed'].defaultThumbnail;
    expect(filled).toEqual(expect.objectContaining(thumbnail));

    feed.get('defaultThumbnail')!.patchValue(filled);
    expect(component['feedDefaultThumbnail']({ 'plugin/thumbnail': thumbnail })['plugin/script/feed'].defaultThumbnail)
      .toEqual(expect.objectContaining(thumbnail));

    url.setValue('cache:uploaded');
    expect(url.pristine).toBe(true);
    expect(component['feedDefaultThumbnail']({ 'plugin/thumbnail': thumbnail })).toEqual({});
  });

  it('keeps a restored feed default thumbnail', async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    component.addTag('plugin/script/feed');
    const plugins = component.webForm.get('plugins') as FormGroup;
    if (!plugins.get('plugin/script/feed')) plugins.addControl('plugin/script/feed', new FormGroup({}));
    const feed = plugins.get('plugin/script/feed') as FormGroup;
    if (!feed.get('defaultThumbnail')) feed.addControl('defaultThumbnail', new FormGroup({ url: new FormControl('https://draft.example/icon.png') }));

    expect(component['feedDefaultThumbnail']({ 'plugin/thumbnail': { url: 'https://blog.example/icon.png', radius: 4 } })).toEqual({});
  });

  it('keeps every feed tag added before the feed form renders', async () => {
    TestBed.inject(AdminService)['pluginToStatus']([feedPlugin]);
    await new Promise(resolve => setTimeout(resolve, 10));
    component.addTag('plugin/script/feed');
    component['addFeedTags']('public');
    component['addFeedTags']('news');
    await fixture.whenStable();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(component.writeRef().plugins['plugin/script/feed'].addTags).toEqual(['public', 'news']);
  });
});
