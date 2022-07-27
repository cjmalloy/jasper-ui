import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';

import { SubmitDmPage } from './dm.component';

describe('SubmitDmPage', () => {
  let component: SubmitDmPage;
  let fixture: ComponentFixture<SubmitDmPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SubmitDmPage ],
      imports: [
        HttpClientTestingModule,
        ReactiveFormsModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubmitDmPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
