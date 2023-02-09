import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MobileTabSelectComponent } from './mobile-tab-select.component';

describe('MobileTabSelectComponent', () => {
  let component: MobileTabSelectComponent;
  let fixture: ComponentFixture<MobileTabSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MobileTabSelectComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MobileTabSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
