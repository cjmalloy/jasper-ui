/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { Observable } from 'rxjs';

import { ExtService } from '../../service/api/ext.service';
import { EditorService } from '../../service/editor.service';
import { ExtComponent } from './ext.component';

describe('ExtComponent', () => {
  let component: ExtComponent;
  let fixture: ComponentFixture<ExtComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        forwardRef(() => ExtComponent),
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ExtComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('ext', { tag: 'ext' });
    fixture.detectChanges();
  });

  afterEach(() => {
    const extService = TestBed.inject(ExtService);
    clearTimeout(extService['_batchTimer']);
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('resets local editor state when the entity changes without running init', () => {
    component.editing.set(true);
    component.viewSource.set(true);
    component.deleted.set(true);
    component.submitted.set(true);
    component.serverError.set(['old error']);
    component.ext.set({ tag: 'replacement' });
    expect(component.editing()).toBe(false);
    expect(component.viewSource()).toBe(false);
    expect(component.deleted()).toBe(false);
    expect(component.submitted()).toBe(false);
    expect(component.serverError()).toEqual([]);
  });

  it('reacts to template configuration changes without reinitializing the entity', () => {
    const views = signal([{ tag: 'view', config: { view: 'first' } }]);
    vi.spyOn(component.admin, 'getTemplateView').mockImplementation(() => views());
    component.ext.set({ tag: 'replacement' });
    expect(component.icons()[0].config?.view).toBe('first');
    views.set([{ tag: 'view', config: { view: 'second' } }]);
    expect(component.icons()[0].config?.view).toBe('second');
  });

  it('cancels the previous preview subscription when the tag changes', () => {
    const cancelled = vi.fn();
    const editor = TestBed.inject(EditorService);
    vi.spyOn(editor, 'getTagPreview').mockReturnValue(new Observable(() => cancelled));
    fixture.componentRef.setInput('ext', { tag: 'first' });
    fixture.detectChanges();
    fixture.componentRef.setInput('ext', { tag: 'second' });
    fixture.detectChanges();
    expect(cancelled).toHaveBeenCalledOnce();
  });
});
