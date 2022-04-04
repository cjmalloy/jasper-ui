import { ComponentFixture, TestBed } from "@angular/core/testing";

import { SubmitTextPage } from "./text.component";

describe('TextComponent', () => {
  let component: SubmitTextPage;
  let fixture: ComponentFixture<SubmitTextPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SubmitTextPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubmitTextPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
