/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { InlinePluginComponent } from './inline-plugin.component';

describe('InlinePluginComponent', () => {
  let component: InlinePluginComponent;
  let fixture: ComponentFixture<InlinePluginComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [
        RouterModule.forRoot([]),
        InlinePluginComponent,
    ],
    providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
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
