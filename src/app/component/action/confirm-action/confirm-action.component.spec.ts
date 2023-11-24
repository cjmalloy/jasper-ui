import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmActionComponent } from './confirm-action.component';

describe('ConfirmActionComponent', () => {
  let component: ConfirmActionComponent;
  let fixture: ComponentFixture<ConfirmActionComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ConfirmActionComponent]
    });
    fixture = TestBed.createComponent(ConfirmActionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
