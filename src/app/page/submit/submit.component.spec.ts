import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';

import { SubmitPage } from './submit.component';

describe('SubmitComponent', () => {
  let component: SubmitPage;
  let fixture: ComponentFixture<SubmitPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SubmitPage],
      imports: [
        HttpClientModule,
        RouterTestingModule,
        ReactiveFormsModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubmitPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
