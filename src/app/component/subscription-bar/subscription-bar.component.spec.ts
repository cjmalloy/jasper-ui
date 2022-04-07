import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubscriptionBarComponent } from './subscription-bar.component';

describe('SubscriptionBarComponent', () => {
  let component: SubscriptionBarComponent;
  let fixture: ComponentFixture<SubscriptionBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SubscriptionBarComponent],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubscriptionBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
