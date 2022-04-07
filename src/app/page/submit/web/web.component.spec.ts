import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubmitWebPage } from './web.component';

describe('WebComponent', () => {
  let component: SubmitWebPage;
  let fixture: ComponentFixture<SubmitWebPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SubmitWebPage],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubmitWebPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
