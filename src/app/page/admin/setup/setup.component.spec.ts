import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminSetupPage } from './setup.component';

describe('SetupComponent', () => {
  let component: AdminSetupPage;
  let fixture: ComponentFixture<AdminSetupPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdminSetupPage],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminSetupPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
