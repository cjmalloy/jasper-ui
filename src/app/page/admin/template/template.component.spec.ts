import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';

import { AdminTemplatePage } from './template.component';

describe('AdminTemplatePage', () => {
  let component: AdminTemplatePage;
  let fixture: ComponentFixture<AdminTemplatePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdminTemplatePage],
      imports: [
        HttpClientModule,
        RouterTestingModule,
      ],
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
