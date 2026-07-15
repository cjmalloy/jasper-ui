/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { ExtService } from './service/api/ext.service';
import { AdminService } from './service/admin.service';
import { Store } from './store/store';

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

  it('should link unmet dependencies to the installed store tab', () => {
    const admin = TestBed.inject(AdminService);
    admin.status.plugins['plugin/mod/store'] = {
      tag: 'plugin/mod/store',
      config: { mod: 'Store' },
    };
    const store = TestBed.inject(Store);
    store.eventBus.progressDen = 1;
    store.eventBus.unmetDependency('Community Tools');
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('.store-dependency-link');
    expect(link.textContent).toContain('Community Tools');
    expect(link.getAttribute('href')).toContain('/settings/ref/plugin/mod/store');
    expect(link.getAttribute('href')).toContain('search=Community+Tools');
  });
});
