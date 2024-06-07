import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { SubmitInvoicePage } from './invoice.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('SubmitInvoicePage', () => {
  let component: SubmitInvoicePage;
  let fixture: ComponentFixture<SubmitInvoicePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [SubmitInvoicePage],
    imports: [ReactiveFormsModule,
        RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
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
