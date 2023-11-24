import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InlineTagComponent } from './inline-tag.component';

describe('InlineTagComponent', () => {
  let component: InlineTagComponent;
  let fixture: ComponentFixture<InlineTagComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [InlineTagComponent]
    });
    fixture = TestBed.createComponent(InlineTagComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
