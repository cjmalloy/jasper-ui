import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { InboxSentPage } from './sent.component';

describe('InboxSentPage', () => {
  let component: InboxSentPage;
  let fixture: ComponentFixture<InboxSentPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InboxSentPage ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InboxSentPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
