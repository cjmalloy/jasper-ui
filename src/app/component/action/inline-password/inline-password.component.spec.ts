/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InlinePasswordComponent } from './inline-password.component';

describe('InlinePasswordComponent', () => {
  let component: InlinePasswordComponent;
  let fixture: ComponentFixture<InlinePasswordComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InlinePasswordComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(InlinePasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
