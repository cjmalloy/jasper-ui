import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { InboxDmsPage } from './dms.component';

describe('InboxDmsPage', () => {
  let component: InboxDmsPage;
  let fixture: ComponentFixture<InboxDmsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InboxDmsPage ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
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
