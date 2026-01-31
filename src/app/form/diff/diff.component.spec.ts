import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor';
import { ConfigService } from '../../service/config.service';
import { DiffComponent } from './diff.component';

describe('DiffComponent', () => {
  let component: DiffComponent;
  let fixture: ComponentFixture<DiffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiffComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
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
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    
    fixture = TestBed.createComponent(DiffComponent);
    component = fixture.componentInstance;
    component.original = { url: 'http://test.com', origin: '', title: 'Original' };
    component.modified = { url: 'http://test.com', origin: '', title: 'Modified' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize original model', () => {
    expect(component.originalModel).toBeDefined();
    expect(component.originalModel.language).toBe('json');
    expect(component.originalModel.code).toContain('Original');
  });

  it('should initialize modified model', () => {
    expect(component.modifiedModel).toBeDefined();
    expect(component.modifiedModel.language).toBe('json');
    expect(component.modifiedModel.code).toContain('Modified');
  });

  it('should have json language in options', () => {
    expect(component.options.language).toBe('json');
  });

  it('should have automaticLayout enabled', () => {
    expect(component.options.automaticLayout).toBe(true);
  });

  it('should return parsed JSON from getModifiedContent', () => {
    component.modifiedModel.code = '{"url":"http://test.com","title":"Test"}';
    const content = component.getModifiedContent();
    expect(content).toEqual({ url: 'http://test.com', title: 'Test' });
  });

  it('should return null for invalid JSON in getModifiedContent', () => {
    component.modifiedModel.code = 'not valid json';
    const content = component.getModifiedContent();
    expect(content).toBeNull();
  });
});
