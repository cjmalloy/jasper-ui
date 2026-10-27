/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ExtService } from '../../service/api/ext.service';

import { ExtPage } from './ext.component';

describe('ExtPage', () => {
  let component: ExtPage;
  let fixture: ComponentFixture<ExtPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        forwardRef(() => ExtPage),
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExtPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not ask to discard the draft after deleting', () => {
    const ext = { tag: 'science', origin: '' };
    const form = new FormGroup({ name: new FormControl('') });
    form.markAsDirty();
    component.editForm.set(form as any);
    component.store.view.exts.set([ext]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(TestBed.inject(ExtService), 'delete').mockReturnValue(of(null) as any);
    vi.spyOn(component.router, 'navigate').mockResolvedValue(true);

    component.delete();

    expect(component.saveChanges()).toBe(true);
  });
});
