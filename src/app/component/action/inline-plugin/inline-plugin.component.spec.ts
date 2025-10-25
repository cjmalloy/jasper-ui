/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { InlinePluginComponent } from './inline-plugin.component';

describe('InlinePluginComponent', () => {
  let component: InlinePluginComponent;
  let fixture: ComponentFixture<InlinePluginComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InlinePluginComponent,],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(InlinePluginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
