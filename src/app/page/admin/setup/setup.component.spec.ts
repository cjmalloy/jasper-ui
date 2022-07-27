import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';

import { AdminSetupPage } from './setup.component';

describe('AdminSetupPage', () => {
  let component: AdminSetupPage;
  let fixture: ComponentFixture<AdminSetupPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdminSetupPage],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        ReactiveFormsModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminSetupPage);
    component = fixture.componentInstance;
    component.admin.def = {plugins: {}, templates: {}};
    component.admin.status = {plugins: {}, templates: {}};
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
