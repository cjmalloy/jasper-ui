import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OriginListComponent } from './origin-list.component';

describe('OriginListComponent', () => {
  let component: OriginListComponent;
  let fixture: ComponentFixture<OriginListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OriginListComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OriginListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
