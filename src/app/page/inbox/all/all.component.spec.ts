import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { InboxAllPage } from './all.component';

describe('InboxAllPage', () => {
  let component: InboxAllPage;
  let fixture: ComponentFixture<InboxAllPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InboxAllPage ],
      imports: [
        HttpClientTestingModule,
        RouterModule.forRoot([]),
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InboxAllPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
