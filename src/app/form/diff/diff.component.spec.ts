/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor';
import { ConfigService } from '../../service/config.service';
import { DiffComponent } from './diff.component';

describe('DiffComponent', () => {
  let component: DiffComponent<any>;
  let fixture: ComponentFixture<DiffComponent<any>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiffComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: NGX_MONACO_EDITOR_CONFIG,
          useValue: {}
        },
        {
          provide: ConfigService,
          useValue: {
            get mobile() { return false; },
            get base() { return { href: 'http://localhost' }; }
          }
        }
      ],
    }).compileComponents();
    
    fixture = TestBed.createComponent(DiffComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('original', { url: 'http://test.com', origin: '', title: 'Original' });
    fixture.componentRef.setInput('modified', { url: 'http://test.com', origin: '', title: 'Modified' });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize original model', () => {
    expect(component.originalModel()).toBeDefined();
    expect(component.originalModel().language).toBe('json');
    expect(component.originalModel().code).toContain('Original');
  });

  it('should initialize modified model', () => {
    expect(component.modifiedModel()).toBeDefined();
    expect(component.modifiedModel().language).toBe('json');
    expect(component.modifiedModel().code).toContain('Modified');
  });

  it('should have json language in options', () => {
    expect(component.options().language).toBe('json');
  });

  it('should have automaticLayout enabled', () => {
    expect(component.options().automaticLayout).toBe(true);
  });

  it('should disable the resize handle when resizable is false', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(DiffComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('original', { url: 'http://test.com', origin: '', title: 'Original' });
    fixture.componentRef.setInput('modified', { url: 'http://test.com', origin: '', title: 'Modified' });
    fixture.componentRef.setInput('resizable', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.resize-handle')).toBeFalsy();
  });

  function fakeEditor(code: string) {
    return { getModel: () => ({ modified: { getValue: () => code } }) };
  }

  it('should return parsed JSON from getModifiedContent', () => {
    component.initEditor(fakeEditor('{"url":"http://test.com","title":"Test"}'));
    const content = component.getModifiedContent();
    expect(content).toEqual({ url: 'http://test.com', title: 'Test' });
  });

  it('should return unedited modified content before the editor loads', () => {
    expect(component.getModifiedContent()).toEqual(expect.objectContaining({ title: 'Modified' }));
  });

  it('should return null for invalid JSON in getModifiedContent', () => {
    component.initEditor(fakeEditor('not valid json'));
    const content = component.getModifiedContent();
    expect(content).toBeNull();
  });

  it('should keep editor models and options referentially stable', () => {
    const original = component.originalModel();
    const modified = component.modifiedModel();
    const options = component.options();
    component.initEditor(fakeEditor('{"edited":true}'));
    fixture.componentRef.setInput('modified', { url: 'http://test.com', origin: '', title: 'Modified' });
    fixture.detectChanges();
    expect(component.originalModel()).toBe(original);
    expect(component.modifiedModel()).toBe(modified);
    expect(component.options()).toBe(options);
  });
});
