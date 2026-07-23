/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { runInAction } from 'mobx';
import { Observable, of } from 'rxjs';

import { Page } from '../../model/page';
import { RefService } from '../../service/api/ref.service';
import { RefListComponent } from '../ref/ref-list/ref-list.component';
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

  it('uses the list renderer while retaining the active Ext', () => {
    vi.spyOn(component.admin, 'getTemplate').mockReturnValue({ tag: 'kanban' } as any);
    component.ext = {
      tag: 'kanban/test',
      origin: '',
      config: { pinned: ['https://example.com/pinned'] },
    };
    component.listView = true;

    expect(component.isTemplate('kanban')).toBe(false);
    expect(component.ext.config?.pinned).toEqual(['https://example.com/pinned']);
  });

  it('shows active Ext pins in the lens', () => {
    const refs = TestBed.inject(RefService);
    vi.spyOn(refs, 'getCurrent').mockReturnValue(new Observable(() => {}));
    component.pinnedExt = {
      tag: 'kanban/test',
      origin: '',
      config: { pinned: ['https://example.com/pinned'] },
    };

    fixture.detectChanges();

    const pinned = fixture.debugElement.query(By.css('.lens-pins')).componentInstance as RefListComponent;
    expect(pinned.ext?.config?.pinned).toEqual(['https://example.com/pinned']);
  });

  it('loads active Ext pins', () => {
    const refs = TestBed.inject(RefService);
    vi.spyOn(refs, 'getCurrent').mockReturnValue(of({
      url: 'https://example.com/pinned',
      title: 'Pinned ref',
    }));

    component.pinnedExt = {
      tag: 'kanban/test',
      origin: '',
      config: { pinned: ['https://example.com/pinned'] },
    };

    expect(component.pinnedPage.content).toEqual([{
      url: 'https://example.com/pinned',
      title: 'Pinned ref',
    }]);
  });

  it('loads pins from the rendered Ext without an override', () => {
    const refs = TestBed.inject(RefService);
    vi.spyOn(refs, 'getCurrent').mockReturnValue(of({
      url: 'https://example.com/pinned',
    }));
    component.ext = {
      tag: 'kanban/test',
      origin: '',
      config: { pinned: ['https://example.com/pinned'] },
    };

    component.ngOnChanges({
      ext: {
        previousValue: undefined,
        currentValue: component.ext,
        firstChange: true,
        isFirstChange: () => true,
      },
    });

    expect(component.pinnedPage.content).toEqual([{
      url: 'https://example.com/pinned',
    }]);
  });

  it('clears existing pins while a different Ext loads', () => {
    const refs = TestBed.inject(RefService);
    vi.spyOn(refs, 'getCurrent').mockReturnValue(new Observable(() => {}));
    component.pinnedPage = Page.of([{ url: 'https://example.com/old' }]);

    component.pinnedExt = {
      tag: 'kanban/next',
      origin: '',
      config: { pinned: ['https://example.com/next'] },
    };

    expect(component.pinnedPage.content).toEqual([]);
  });

  it.each([
    ['sourcesOf', '.sources-of'],
    ['responseOf', '.responses-of'],
  ] as const)('reacts when query.%s loads', async (property, selector) => {
    expect(fixture.nativeElement.querySelector(selector)).toBeNull();

    runInAction(() => component.query[property] = {
      url: 'https://example.com/ref',
      title: 'Filtered ref',
    });

    await vi.waitFor(() => {
      expect(fixture.nativeElement.querySelector(selector)).not.toBeNull();
    });
  });
});
