import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';

import { SubmitFeedPage } from './feed.component';

describe('SubmitFeedPage', () => {
  let component: SubmitFeedPage;
  let fixture: ComponentFixture<SubmitFeedPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SubmitFeedPage],
      imports: [
        HttpClientModule,
        ReactiveFormsModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubmitFeedPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
