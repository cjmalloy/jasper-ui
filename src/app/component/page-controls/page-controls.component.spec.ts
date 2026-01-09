/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateTime } from 'luxon';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';

import { PageControlsComponent } from './page-controls.component';

describe('PageControlsComponent', () => {
  let component: PageControlsComponent;
  let fixture: ComponentFixture<PageControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageControlsComponent],
        providers: [
          provideRouter([]),
        ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PageControlsComponent);
    component = fixture.componentInstance;
    component.page = Page.of([]);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should detect cursor-based pagination for modified sort', () => {
    // Set up a sort by modified
    component.store.view.route.routeSnapshot = {
      queryParams: { sort: ['modified,DESC'] }
    } as any;

    expect(component.primarySort).toBe('modified');
    expect(component.useCursor).toBe(true);
  });

  it('should detect cursor-based pagination for created sort', () => {
    component.store.view.route.routeSnapshot = {
      queryParams: { sort: ['created,DESC'] }
    } as any;

    expect(component.primarySort).toBe('created');
    expect(component.useCursor).toBe(true);
  });

  it('should detect cursor-based pagination for published sort', () => {
    component.store.view.route.routeSnapshot = {
      queryParams: { sort: ['published,DESC'] }
    } as any;

    expect(component.primarySort).toBe('published');
    expect(component.useCursor).toBe(true);
  });

  it('should not use cursor-based pagination for other sorts', () => {
    component.store.view.route.routeSnapshot = {
      queryParams: { sort: ['title,ASC'] }
    } as any;

    expect(component.primarySort).toBe('title');
    expect(component.useCursor).toBe(false);
  });

  it('should get correct sort direction for DESC', () => {
    component.store.view.route.routeSnapshot = {
      queryParams: { sort: ['modified,DESC'] }
    } as any;

    expect(component.sortDirection).toBe('DESC');
  });

  it('should get correct sort direction for ASC', () => {
    component.store.view.route.routeSnapshot = {
      queryParams: { sort: ['modified,ASC'] }
    } as any;

    expect(component.sortDirection).toBe('ASC');
  });
});
