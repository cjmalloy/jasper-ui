import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { InboxAllPage } from './all.component';

describe('InboxAllPage', () => {
  let component: InboxAllPage;
  let fixture: ComponentFixture<InboxAllPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InboxAllPage],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
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
