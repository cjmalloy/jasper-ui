import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';
import { Ext } from '../../../model/ext';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AccountService } from '../../../service/account.service';
import { RefService } from '../../../service/api/ref.service';

import { InboxUnreadPage } from './unread.component';

describe('InboxUnreadPage', () => {
  let component: InboxUnreadPage;
  let fixture: ComponentFixture<InboxUnreadPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InboxUnreadPage ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: RefService, useValue: { page: () => new BehaviorSubject<Page<Ref>>({
              content: [],
              empty: false,
              first: false,
              last: false,
              number: 0,
              size: 0,
              totalElements: 0,
              totalPages: 0
            }) }
          },
        { provide: AccountService, useValue: { userExt$: new BehaviorSubject<Ext>({tag: 'user/test'}) } },
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InboxUnreadPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
