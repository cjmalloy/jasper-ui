import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InlineSelectComponent } from './inline-select.component';

describe('InlineSelectComponent', () => {
  let component: InlineSelectComponent;
  let fixture: ComponentFixture<InlineSelectComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [InlineSelectComponent]
});
    fixture = TestBed.createComponent(InlineSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
