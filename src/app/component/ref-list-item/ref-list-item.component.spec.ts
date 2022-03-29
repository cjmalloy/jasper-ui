import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RefListItemComponent } from './ref-list-item.component';

describe('RefListItemComponent', () => {
  let component: RefListItemComponent;
  let fixture: ComponentFixture<RefListItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RefListItemComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefListItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
