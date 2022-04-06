import { ComponentFixture, TestBed } from "@angular/core/testing";

import { CreateExtPage } from "./ext.component";

describe('ExtComponent', () => {
  let component: CreateExtPage;
  let fixture: ComponentFixture<CreateExtPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CreateExtPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CreateExtPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
