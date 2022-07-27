import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { RefGraphComponent } from './graph.component';

describe('RefGraphComponent', () => {
  let component: RefGraphComponent;
  let fixture: ComponentFixture<RefGraphComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RefGraphComponent],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
