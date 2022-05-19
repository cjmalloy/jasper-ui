import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RefMissingComponent } from './missing.component';

describe('MissingComponent', () => {
  let component: RefMissingComponent;
  let fixture: ComponentFixture<RefMissingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RefMissingComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefMissingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
