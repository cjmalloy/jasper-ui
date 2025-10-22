/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InlineButtonComponent } from './inline-button.component';

describe('InlineButtonComponent', () => {
  let component: InlineButtonComponent;
  let fixture: ComponentFixture<InlineButtonComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [InlineButtonComponent]
});
    fixture = TestBed.createComponent(InlineButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
