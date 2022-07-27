import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { RefResponsesComponent } from './responses.component';

describe('RefResponsesComponent', () => {
  let component: RefResponsesComponent;
  let fixture: ComponentFixture<RefResponsesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RefResponsesComponent],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefResponsesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
