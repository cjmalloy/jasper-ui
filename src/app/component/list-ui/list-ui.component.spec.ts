/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import * as Handlebars from 'handlebars/dist/cjs/handlebars';
import { of } from 'rxjs';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { ListUiApi, Template } from '../../model/template';
import { RefService } from '../../service/api/ref.service';
import { ListUiComponent } from './list-ui.component';

describe('ListUiComponent', () => {
  let fixture: ComponentFixture<ListUiComponent>;
  let actions: ListUiApi | undefined;
  const refs = { page: vi.fn() };

  const template = (): Template => ({
    tag: 'test',
    config: {
      listUi: '<p class="out">{{query}} {{page.content.length}} {{peek}}</p>{{listUiProbe actions}}',
    },
  });

  beforeEach(async () => {
    actions = undefined;
    refs.page.mockReset();
    Handlebars.registerHelper('listUiProbe', (a: ListUiApi) => { actions = a; });
    TestBed.configureTestingModule({
      imports: [ListUiComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: RefService, useValue: refs },
      ],
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(ListUiComponent);
    fixture.componentRef.setInput('template', template());
    fixture.componentRef.setInput('ext', { tag: 'test', config: { peek: 2 } });
    fixture.componentRef.setInput('tag', 'science');
    fixture.componentRef.setInput('page', Page.of<Ref>([{ url: 'https://example.com' }]));
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders the template with the view scope', () => {
    expect(fixture.nativeElement.querySelector('.out').textContent).toBe('science 1 2');
    expect(actions).toBeTruthy();
  });

  it('runs cleanups on re-render and destroy', async () => {
    const first = vi.fn();
    actions!.onDestroy(first);
    fixture.componentRef.setInput('tag', 'math');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(first).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.out').textContent).toBe('math 1 2');

    const stale = vi.fn();
    const second = vi.fn();
    actions!.onDestroy(second);
    fixture.destroy();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    actions!.onDestroy(stale);
    expect(stale).toHaveBeenCalledTimes(1);
  });

  it('fetches more pages of the same query', async () => {
    refs.page.mockReturnValue(of(Page.of<Ref>([])));
    fixture.componentRef.setInput('filter', ['query/plugin/image']);
    fixture.componentRef.setInput('search', 'cats');
    fixture.detectChanges();
    await fixture.whenStable();
    await actions!.fetch(2, 10);
    expect(refs.page).toHaveBeenCalledWith(expect.objectContaining({
      query: 'science:plugin/image:!internal:!plugin/delete',
      search: 'cats',
      page: 2,
      size: 10,
    }));
  });
});
