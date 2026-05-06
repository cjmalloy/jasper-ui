/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { TagsFormComponent } from '../../../form/tags/tags.component';
import { JasperFormlyModule } from '../../../formly/formly.module';
import { SubmitStore } from '../../../store/submit';

import { SubmitTextPage } from './text.component';

describe('SubmitTextPage', () => {
  let component: SubmitTextPage;
  let fixture: ComponentFixture<SubmitTextPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        JasperFormlyModule,
        SubmitTextPage,
        TagsFormComponent
      ],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmitTextPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize a generated url for text posts', () => {
    expect(component.url.value).toMatch(/^comment:/);
  });

  it('should regenerate a missing url before writing a ref', () => {
    component.url.setValue('');

    const ref = component.writeRef();

    expect(ref.url).toMatch(/^comment:/);
    expect(ref.url).toBe(component['generatedUrl']);
    expect(component.url.value).toBe(ref.url);
  });

  it('should prefer the route url over the existing control value', () => {
    component.url.setValue('comment:local');
    vi.spyOn(SubmitStore.prototype, 'url', 'get').mockReturnValue('comment:route');

    const ref = component.writeRef();

    expect(ref.url).toBe('comment:route');
    expect(component.url.value).toBe('comment:route');
  });

  it('should not keep a bare wiki prefix as the url', () => {
    component.url.setValue('');
    vi.spyOn(SubmitStore.prototype, 'url', 'get').mockReturnValue('wiki:');
    vi.spyOn(SubmitStore.prototype, 'wiki', 'get').mockReturnValue(true);
    vi.spyOn(component.admin, 'getWikiPrefix').mockReturnValue('wiki:');

    const ref = component.writeRef();

    expect(ref.url).toMatch(/^wiki:.+/);
    expect(ref.url).not.toBe('wiki:');
    expect(component.url.value).toBe(ref.url);
  });
});
