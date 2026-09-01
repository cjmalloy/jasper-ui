/// <reference types="vitest/globals" />
import { HttpErrorResponse, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { LinksFormComponent } from '../../../form/links/links.component';
import { RefFormComponent } from '../../../form/ref/ref.component';
import { TagsFormComponent } from '../../../form/tags/tags.component';
import { JasperFormlyModule } from '../../../formly/formly.module';

import { SubmitWebPage } from './web.component';

describe('SubmitWebPage', () => {
  let component: SubmitWebPage;
  let fixture: ComponentFixture<SubmitWebPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        JasperFormlyModule,
        SubmitWebPage,
        RefFormComponent,
        TagsFormComponent,
        LinksFormComponent,
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmitWebPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers to convert an already existing ref into a repost', () => {
    component.url = 'https://example.com';
    vi.spyOn(component.webForm, 'valid', 'get').mockReturnValue(true);
    vi.spyOn(component, 'syncEditor').mockImplementation(() => {});
    vi.spyOn(component, 'writeRef').mockReturnValue({ tags: [] } as any);
    vi.spyOn(component['refs'], 'create').mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { detail: 'Already exists' },
    })));

    component.submit();

    expect(component.alreadyExists).toBe(true);
    expect(component.serverError).toEqual(['Already exists']);

    const addTag = vi.spyOn(component, 'addTag');
    const addSource = vi.spyOn(component, 'addSource');
    component.submit();

    expect(component.url).toMatch(/^internal:/);
    expect(addTag).toHaveBeenCalledWith('plugin/repost');
    expect(addSource).toHaveBeenCalledWith('https://example.com');
    expect(component.alreadyExists).toBe(false);
    expect(component.submitted).toBe(false);
  });
});
