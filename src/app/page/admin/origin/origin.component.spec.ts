import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminOriginPage } from './origin.component';

describe('OriginComponent', () => {
  let component: AdminOriginPage;
  let fixture: ComponentFixture<AdminOriginPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdminOriginPage],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminOriginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
