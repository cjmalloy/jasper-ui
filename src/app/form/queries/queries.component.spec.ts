import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QueriesFormComponent } from './queries.component';

describe('QueriesComponent', () => {
  let component: QueriesFormComponent;
  let fixture: ComponentFixture<QueriesFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QueriesFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QueriesFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
