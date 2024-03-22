import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { InboxModlistPage } from './modlist.component';

describe('InboxModlistPage', () => {
  let component: InboxModlistPage;
  let fixture: ComponentFixture<InboxModlistPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InboxModlistPage ],
      imports: [
        HttpClientTestingModule,
        RouterModule.forRoot([]),
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InboxModlistPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
