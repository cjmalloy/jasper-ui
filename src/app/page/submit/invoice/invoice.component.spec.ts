import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubmitInvoicePage } from './invoice.component';

describe('InvoiceComponent', () => {
  let component: SubmitInvoicePage;
  let fixture: ComponentFixture<SubmitInvoicePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SubmitInvoicePage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubmitInvoicePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
