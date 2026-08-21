/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateTime } from 'luxon';
import { EMPTY, Subject } from 'rxjs';
import { RefUpdates } from '../../model/ref';

import { RefPage } from './ref.component';

describe('RefPage', () => {
  let component: RefPage;
  let fixture: ComponentFixture<RefPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => RefPage)],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('refreshes partial websocket updates with the complete Ref', () => {
    const url = 'comment:thread';
    const created = DateTime.fromISO('2026-01-01T00:00:00Z');
    const updates = new Subject<RefUpdates>();
    component.store.view.setRef({
      url,
      origin: '',
      created,
      tags: ['plugin/thread'],
    });
    vi.spyOn(component['refs'], 'count').mockReturnValue(EMPTY);
    vi.spyOn(component['stomp'], 'watchRef').mockReturnValue(updates);
    vi.spyOn(component['stomp'], 'watchResponse').mockReturnValue(EMPTY);
    const refresh = vi.spyOn(component.store.eventBus, 'refresh');

    component.reload(url);
    updates.next({
      url,
      origin: '',
      tags: ['plugin/thread', '+plugin/error'],
    });

    expect(refresh).toHaveBeenCalledWith(expect.objectContaining({
      url,
      created,
      tags: ['plugin/thread', '+plugin/error'],
    }));
  });
});
