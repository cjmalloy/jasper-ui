/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { Subject } from 'rxjs';

import { BlogEntryComponent } from './blog-entry.component';

describe('BlogEntryComponent', () => {
  let component: BlogEntryComponent;
  let fixture: ComponentFixture<BlogEntryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        forwardRef(() => BlogEntryComponent),
        MarkdownModule.forRoot(),
        ReactiveFormsModule,
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogEntryComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('ref', { url: '' });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('recomputes derived values and resets editor state without init', () => {
    component.editing.set(true);
    fixture.componentRef.setInput('ref', { url: 'https://example.com', title: 'Updated', tags: ['topic'] });
    expect(component.title()).toBe('Updated');
    expect(component.tags()).toEqual(['topic']);
    expect(component.editing()).toBe(false);
  });

  it('cancels a pending save when the editor is toggled closed', () => {
    const request = new Subject<string>();
    vi.spyOn(component['refs'], 'update').mockReturnValue(request);
    vi.spyOn(component['editor'], 'syncEditor').mockImplementation(() => {});
    vi.spyOn(component.editForm, 'valid', 'get').mockReturnValue(true);
    component.editing.set(true);
    component.save();
    expect(component.submitting()).toBe(true);
    component.toggleEditing();
    expect(request.observed).toBe(false);
    expect(component.submitting()).toBe(false);
    expect(component.editing()).toBe(false);
  });
});
