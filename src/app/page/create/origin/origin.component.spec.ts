import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';

import { CreateOriginPage } from './origin.component';

describe('CreateOriginPage', () => {
  let component: CreateOriginPage;
  let fixture: ComponentFixture<CreateOriginPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CreateOriginPage ],
      imports: [
        RouterTestingModule,
        HttpClientTestingModule,
        ReactiveFormsModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CreateOriginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
