import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InlineButtonComponent } from './inline-button.component';

describe('InlineButtonComponent', () => {
  let component: InlineButtonComponent;
  let fixture: ComponentFixture<InlineButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InlineButtonComponent]
    ,
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(InlineButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
