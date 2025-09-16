import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserTagSelectorComponent } from './user-tag-selector.component';

describe('UserTagSelectorComponent', () => {
  let component: UserTagSelectorComponent;
  let fixture: ComponentFixture<UserTagSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UserTagSelectorComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserTagSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});