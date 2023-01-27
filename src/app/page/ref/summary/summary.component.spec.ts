import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { RefSummaryComponent } from './summary.component';

describe('RefSummaryComponent', () => {
  let component: RefSummaryComponent;
  let fixture: ComponentFixture<RefSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RefSummaryComponent ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RefSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
