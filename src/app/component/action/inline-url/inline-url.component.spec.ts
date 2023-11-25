import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InlineUrlComponent } from './inline-url.component';

describe('InlineUrlComponent', () => {
  let component: InlineUrlComponent;
  let fixture: ComponentFixture<InlineUrlComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [InlineUrlComponent]
    });
    fixture = TestBed.createComponent(InlineUrlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
