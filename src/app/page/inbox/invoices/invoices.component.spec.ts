import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InboxInvoicesPage } from './invoices.component';

describe('InvoicesComponent', () => {
  let component: InboxInvoicesPage;
  let fixture: ComponentFixture<InboxInvoicesPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InboxInvoicesPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InboxInvoicesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
