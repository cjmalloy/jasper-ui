import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InlineSelectComponent } from './inline-select.component';

describe('InlineSelectComponent', () => {
  let component: InlineSelectComponent;
  let fixture: ComponentFixture<InlineSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InlineSelectComponent]
    ,
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(InlineSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
