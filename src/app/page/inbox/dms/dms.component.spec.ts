import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InboxDmsPage } from './dms.component';

describe('InboxDmsPage', () => {
  let component: InboxDmsPage;
  let fixture: ComponentFixture<InboxDmsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InboxDmsPage ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InboxDmsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
