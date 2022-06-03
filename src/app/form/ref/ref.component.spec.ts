import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RefFormComponent } from './ref.component';

describe('RefComponent', () => {
  let component: RefFormComponent;
  let fixture: ComponentFixture<RefFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RefFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
