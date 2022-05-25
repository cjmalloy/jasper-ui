import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';

import { CreateExtPage } from './ext.component';

describe('CreateExtPage', () => {
  let component: CreateExtPage;
  let fixture: ComponentFixture<CreateExtPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CreateExtPage],
      imports: [
        HttpClientModule,
        ReactiveFormsModule,
        RouterTestingModule,
      ],
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
