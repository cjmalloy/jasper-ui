import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { InboxInvoicesPage } from './invoices.component';

describe('InboxInvoicesPage', () => {
  let component: InboxInvoicesPage;
  let fixture: ComponentFixture<InboxInvoicesPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InboxInvoicesPage ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
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
