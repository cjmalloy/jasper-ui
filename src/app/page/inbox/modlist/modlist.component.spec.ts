import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InboxModlistPage } from './modlist.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('InboxModlistPage', () => {
  let component: InboxModlistPage;
  let fixture: ComponentFixture<InboxModlistPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InboxModlistPage ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
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
