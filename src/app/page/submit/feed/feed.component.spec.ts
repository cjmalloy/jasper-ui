import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { TagsFormComponent } from '../../../form/tags/tags.component';

import { SubmitFeedPage } from './feed.component';

describe('SubmitFeedPage', () => {
  let component: SubmitFeedPage;
  let fixture: ComponentFixture<SubmitFeedPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        SubmitFeedPage,
        TagsFormComponent
      ],
      imports: [
        HttpClientTestingModule,
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
