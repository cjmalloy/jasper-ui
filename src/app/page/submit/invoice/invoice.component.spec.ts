/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { QrScannerComponent } from '../../../formly/qr-scanner/qr-scanner.component';

import { SubmitInvoicePage } from './invoice.component';

@Component({
  selector: 'app-qr-scanner',
  template: '',
})
class StubQrScannerComponent {
  readonly data = output<string>();
}

describe('SubmitInvoicePage', () => {
  let component: SubmitInvoicePage;
  let fixture: ComponentFixture<SubmitInvoicePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        SubmitInvoicePage,
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    })
      .overrideComponent(SubmitInvoicePage, {
        remove: { imports: [QrScannerComponent] },
        add: { imports: [StubQrScannerComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SubmitInvoicePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
