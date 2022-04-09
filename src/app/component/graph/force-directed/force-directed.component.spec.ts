import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ForceDirectedComponent } from './force-directed.component';

describe('ForceDirectedComponent', () => {
  let component: ForceDirectedComponent;
  let fixture: ComponentFixture<ForceDirectedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ForceDirectedComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ForceDirectedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
