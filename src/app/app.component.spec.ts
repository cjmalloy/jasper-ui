/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { ExtService } from './service/api/ext.service';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
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

  it('updates the website when debug mode changes', () => {
    component.store.account.debug.set(true);
    expect(component.website()).toBe('https://github.com/cjmalloy/jasper-ui');

    component.store.account.debug.set(false);
    expect(component.website()).toBe(
      'https://github.com/cjmalloy/jasper-ui/releases/tag/' + component.config.version,
    );
  });

  it('renders reactive progress updates', () => {
    component.store.eventBus.clearProgress(2);
    component.store.eventBus.progress('First step');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('progress').value).toBe(1);
    expect(fixture.nativeElement.querySelector('.log').textContent).toContain('First step');

    component.store.eventBus.clearProgress();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.log')).toBeNull();
  });
});
