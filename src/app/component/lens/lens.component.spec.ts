/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { runInAction } from 'mobx';
import { Observable } from 'rxjs';

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

  it('shows active Ext pins with a global view', () => {
    const refs = TestBed.inject(RefService);
    vi.spyOn(refs, 'getCurrent').mockReturnValue(new Observable(() => {}));
    component.pinnedExt = {
      tag: 'kanban/test',
      origin: '',
      config: { pinned: ['https://example.com/pinned'] },
    };
    component.globalView = true;

    fixture.detectChanges();

    const pinned = fixture.debugElement.query(By.directive(RefListComponent)).componentInstance as RefListComponent;
    expect(pinned.ext?.config?.pinned).toEqual(['https://example.com/pinned']);
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
