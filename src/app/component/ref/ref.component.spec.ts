/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SafePipe } from '../../pipe/safe.pipe';

import { RefComponent } from './ref.component';

describe('RefComponent', () => {
  let component: RefComponent;
  let fixture: ComponentFixture<RefComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        forwardRef(() => RefComponent),
        ReactiveFormsModule,
        SafePipe,
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefComponent);
    component = fixture.componentInstance;
    component.ref = { url: '' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('preserves protected and private plugin tags when copying', () => {
    component.ref = {
      url: 'https://example.com',
      origin: '@remote',
      tags: ['public', '+restricted', '_private', '+plugin/secret', '_plugin/cache'],
      plugins: {
        '+plugin/secret': { value: 'secret' },
        '_plugin/cache': { value: 'cached' },
      },
    };
    const refs = (component as any).refs;
    const auth = (component as any).auth;
    vi.spyOn(auth, 'canAddTag').mockReturnValue(true);
    const create = vi.spyOn(refs, 'create').mockReturnValue(of(component.ref));

    component.copy$();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      tags: ['public', '+plugin/secret', '_plugin/cache'],
      plugins: {
        '+plugin/secret': { value: 'secret' },
        '_plugin/cache': { value: 'cached' },
      },
    }));
  });
});
