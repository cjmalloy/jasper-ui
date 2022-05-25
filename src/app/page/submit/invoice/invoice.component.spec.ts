import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';

import { SubmitInvoicePage } from './invoice.component';

describe('SubmitInvoicePage', () => {
  let component: SubmitInvoicePage;
  let fixture: ComponentFixture<SubmitInvoicePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SubmitInvoicePage ],
      imports: [
        ReactiveFormsModule,
        HttpClientModule,
        RouterTestingModule,
      ],
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
