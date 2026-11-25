/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import * as Handlebars from 'handlebars/dist/cjs/handlebars';
import { of } from 'rxjs';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { LensUiApi, Template } from '../../model/template';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { QueryStore } from '../../store/query';
import { LensComponent } from './lens.component';

describe('LensComponent', () => {
  let component: LensComponent;
  let fixture: ComponentFixture<LensComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [LensComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: QueryStore, useValue: { sourcesOf: signal<Ref | undefined>(undefined), responseOf: signal<Ref | undefined>(undefined), refresh: vi.fn() } },
      ],
      deferBlockBehavior: DeferBlockBehavior.Playthrough,
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(LensComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it.each([
    ['sourcesOf', '.sources-of'],
    ['responseOf', '.responses-of'],
  ] as const)('reacts when query.%s loads on a full page', async (property, selector) => {
    fixture.componentRef.setInput('fullPage', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(selector)).toBeNull();

    (component.query[property] as WritableSignal<Ref | undefined>).set({
      url: 'https://example.com/ref',
      title: 'Filtered ref',
    });

    await vi.waitFor(() => {
      expect(fixture.nativeElement.querySelector(selector)).not.toBeNull();
    });
  });

  it('ignores the page query targets in embeds', async () => {
    (component.query.responseOf as WritableSignal<Ref | undefined>).set({ url: 'https://example.com/host' });
    (component.query.sourcesOf as WritableSignal<Ref | undefined>).set({ url: 'https://example.com/host' });
    fixture.componentRef.setInput('tag', '!internal');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.lens-targets')).toBeNull();
  });

  it('shows targets from the embed filter', async () => {
    fixture.destroy();
    const getCurrent = vi.spyOn(TestBed.inject(RefService), 'getCurrent')
      .mockImplementation(url => of({ url, title: 'Embed target' }));
    fixture = TestBed.createComponent(LensComponent);
    (fixture.componentInstance.query.responseOf as WritableSignal<Ref | undefined>).set({ url: 'https://example.com/host' });
    fixture.componentRef.setInput('tag', 'science');
    fixture.componentRef.setInput('filter', ['responses/https://example.com/target']);
    fixture.detectChanges();

    await vi.waitFor(() => {
      expect(fixture.nativeElement.querySelector('.responses-of')).not.toBeNull();
    });
    expect(getCurrent).toHaveBeenCalledWith('https://example.com/target');
    expect(getCurrent).not.toHaveBeenCalledWith('https://example.com/host');
    expect(fixture.nativeElement.querySelector('.sources-of')).toBeNull();
  });

  describe('template ui', () => {
    let actions: LensUiApi | undefined;
    let refs: { page: ReturnType<typeof vi.fn> };
    const template: Template = {
      tag: 'test',
      config: {
        ui: '<p class="out">{{query}} {{page.content.length}} {{peek}}</p>{{lensUiProbe actions}}',
      },
    };

    beforeEach(async () => {
      actions = undefined;
      Handlebars.registerHelper('lensUiProbe', (a: LensUiApi) => { actions = a; });
      fixture.destroy();
      refs = { page: vi.spyOn(TestBed.inject(RefService), 'page') as any };
      vi.spyOn(TestBed.inject(AdminService), 'getTemplateUi').mockReturnValue([template]);
      fixture = TestBed.createComponent(LensComponent);
      fixture.componentRef.setInput('ext', { tag: 'test', config: { peek: 2 } });
      fixture.componentRef.setInput('tag', 'science');
      fixture.componentRef.setInput('page', Page.of<Ref>([{ url: 'https://example.com' }]));
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('renders the template ui as markdown with the view scope', () => {
      expect(fixture.nativeElement.querySelector('.ui .out').textContent).toBe('science 1 2');
      expect(fixture.nativeElement.querySelector('.ref-list')).toBeNull();
      expect(actions).toBeTruthy();
    });

    it('runs cleanups on re-render and destroy', async () => {
      const first = vi.fn();
      actions!.onDestroy(first);
      fixture.componentRef.setInput('tag', 'math');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(first).toHaveBeenCalledTimes(1);
      expect(fixture.nativeElement.querySelector('.ui .out').textContent).toBe('math 1 2');

      const second = vi.fn();
      actions!.onDestroy(second);
      fixture.destroy();
      expect(second).toHaveBeenCalledTimes(1);
      expect(first).toHaveBeenCalledTimes(1);
      const stale = vi.fn();
      actions!.onDestroy(stale);
      expect(stale).toHaveBeenCalledTimes(1);
    });

    it('recreates the ui host when a re-render produces the same html', async () => {
      const host = fixture.nativeElement.querySelector('.ui');
      fixture.componentRef.setInput('size', 12);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.ui')).not.toBe(host);
      expect(fixture.nativeElement.querySelectorAll('.ui').length).toBe(1);
    });

    it('fetches more pages of the same query', async () => {
      refs.page.mockReturnValue(of(Page.of<Ref>([])));
      fixture.componentRef.setInput('filter', ['query/plugin/image']);
      fixture.componentRef.setInput('search', 'cats');
      fixture.detectChanges();
      await fixture.whenStable();
      await actions!.fetch(2, 10);
      expect(refs.page).toHaveBeenCalledWith(expect.objectContaining({
        query: 'science:plugin/image',
        search: 'cats',
        page: 2,
        size: 10,
      }));
    });

    it('fetches more pages with the size of the first request', async () => {
      refs.page.mockReturnValue(of(Page.of<Ref>([])));
      fixture.componentRef.setInput('args', { query: 'science', page: 0, size: 5 });
      fixture.detectChanges();
      await fixture.whenStable();
      await actions!.fetch(1);
      expect(refs.page.mock.calls.at(-1)![0]).toMatchObject({ page: 1, size: 5 });
      await actions!.fetch(2, 10);
      expect(refs.page.mock.calls.at(-1)![0]).toMatchObject({ page: 2, size: 10 });
    });

    it('fetches more pages with the args of the first page and a stable sort', async () => {
      refs.page.mockReturnValue(of(Page.of<Ref>([])));
      fixture.componentRef.setInput('tag', 'config/home');
      fixture.componentRef.setInput('args', { query: '(science|math):!internal', sort: ['published,DESC'], page: 0, size: 24 });
      fixture.detectChanges();
      await fixture.whenStable();
      await actions!.fetch(1);
      expect(refs.page).toHaveBeenCalledWith({
        query: '(science|math):!internal',
        sort: ['published,DESC', 'modified,ASC', 'origin,ASC'],
        page: 1,
        size: 24,
      });
    });
  });
});
