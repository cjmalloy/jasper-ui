import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RefResponsesComponent } from './ref-responses.component';

describe('ResponsesComponent', () => {
  let component: RefResponsesComponent;
  let fixture: ComponentFixture<RefResponsesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RefResponsesComponent],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefResponsesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
