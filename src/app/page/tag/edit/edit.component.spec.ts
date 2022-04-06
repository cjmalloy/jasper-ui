import { ComponentFixture, TestBed } from "@angular/core/testing";

import { EditTagPage } from "./edit.component";

describe('EditComponent', () => {
  let component: EditTagPage;
  let fixture: ComponentFixture<EditTagPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditTagPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditTagPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
