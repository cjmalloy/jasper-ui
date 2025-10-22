/// <reference types="vitest/globals" />
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Ext } from '../../../model/ext';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AccountService } from '../../../service/account.service';
import { RefService } from '../../../service/api/ref.service';

import { InboxUnreadPage } from './unread.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('InboxUnreadPage', () => {
  let component: InboxUnreadPage;
  let fixture: ComponentFixture<InboxUnreadPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([]), InboxUnreadPage],
    providers: [
        { provide: RefService, useValue: { page: () => new BehaviorSubject<Page<Ref>>(Page.of([])) } },
        { provide: AccountService, useValue: { userExt$: new BehaviorSubject<Ext>({ tag: 'user/test' }) } },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
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
