import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import * as moment from 'moment';

import { refForm, RefFormComponent } from './ref.component';

describe('RefFormComponent', () => {
  let component: RefFormComponent;
  let fixture: ComponentFixture<RefFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RefFormComponent ],
      imports: [
        HttpClientTestingModule,
        ReactiveFormsModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefFormComponent);
    component = fixture.componentInstance;
    component.group = new FormGroup({
      url: new FormControl(),
      published: new FormControl(),
      title: new FormControl(),
      comment: new FormControl(),
      sources: new FormControl(),
      alternateUrls: new FormControl(),
      tags: new FormControl(),
      plugins: new FormControl(),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
