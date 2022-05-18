import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AltsComponent } from './alts.component';

describe('AltsComponent', () => {
  let component: AltsComponent;
  let fixture: ComponentFixture<AltsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AltsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AltsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
