import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminTemplatePage } from './template.component';

describe('TemplateComponent', () => {
  let component: AdminTemplatePage;
  let fixture: ComponentFixture<AdminTemplatePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdminTemplatePage],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminTemplatePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
