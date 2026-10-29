/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { VisibilityService } from '../../service/visibility.service';
import { Store } from '../../store/store';

import { NavComponent } from './nav.component';

describe('NavComponent', () => {
  let component: NavComponent;
  let fixture: ComponentFixture<NavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ConfigService,
          useValue: {
            get base() { return { href: 'http://localhost' }; }
          }
        }
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('recomputes the local route when a rendered link is reused', () => {
    fixture.componentRef.setInput('url', 'tag:/first');
    expect(component.nav()).toEqual(['/tag', 'first']);
    fixture.componentRef.setInput('url', 'tag:/second');
    expect(component.nav()).toEqual(['/tag', 'second']);
  });

  it('should not treat plain hashtag as custom text', () => {
    fixture.componentRef.setInput('url', '/tag/notes');
    fixture.componentRef.setInput('text', '#notes');
    expect(component.hasText()).toBe(false);
  });

  it('should not treat hashtag with bookmark params as custom text', () => {
    fixture.componentRef.setInput('url', '/tag/notes?filter=query/+user/chris&sort=created');
    fixture.componentRef.setInput('text', '#notes');
    expect(component.nav()).toEqual(['/tag', 'notes']);
    expect(component.hasText()).toBe(false);
  });

  it('should keep custom link text for tag urls with bookmark params', () => {
    fixture.componentRef.setInput('url', '/tag/notes?filter=query/+user/chris');
    fixture.componentRef.setInput('text', 'My Notes');
    expect(component.hasText()).toBe(true);
  });
});

describe('NavComponent with mocked services', () => {
  let getTagPreview: ReturnType<typeof vi.fn>;
  let store: any;

  async function create(url: string, inputs: Record<string, unknown> = {}) {
    await TestBed.configureTestingModule({
      imports: [NavComponent],
      providers: [
        provideRouter([]),
        { provide: ConfigService, useValue: { base: 'http://localhost/' } },
        { provide: Store, useValue: store },
        { provide: EditorService, useValue: { getTagPreview } },
        { provide: AdminService, useValue: {} },
        { provide: RefService, useValue: {} },
        { provide: TaggingService, useValue: {} },
        { provide: VisibilityService, useValue: {} },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(NavComponent);
    fixture.componentRef.setInput('url', url);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    getTagPreview = vi.fn(() => NEVER);
    store = { view: { browser: () => false, refPath: () => '/ref' } };
  });

  it('links tags to the tag page', async () => {
    const component = await create('tag:/foo');

    expect(component.nav()).toEqual(['/tag', 'foo']);
    expect(component.text()).toBe('#foo');
  });

  it('links tags to the browser synchronously in browser mode', async () => {
    store.view = { browser: () => true, refPath: () => '/browse' };

    const component = await create('tag:/foo');

    expect(component.nav()).toEqual(['/browse', 'tag:/foo']);
  });

  it('falls back to formatAuthor for user tags with shortUser', async () => {
    const component = await create('tag:/+user/alice', { shortUser: true });

    expect(component.text()).toBe('alice');
    expect(component.title()).toBe('alice');
    expect(getTagPreview).toHaveBeenCalledWith('+user/alice', '', true, false);
  });

  it('prefers a resolved name over the user fallback', async () => {
    getTagPreview = vi.fn(() => of({ tag: '+user/alice', name: 'Alice' }));

    const component = await create('tag:/+user/alice', { shortUser: true });

    expect(component.text()).toBe('Alice');
    expect(component.title()).toBe('alice');
  });
});
