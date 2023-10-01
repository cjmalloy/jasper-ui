import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { PageControlsComponent } from './page-controls.component';

describe('PageControlsComponent', () => {
  let component: PageControlsComponent;
  let fixture: ComponentFixture<PageControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PageControlsComponent ],
      imports: [
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PageControlsComponent);
    component = fixture.componentInstance;
    component.page = {
      content: [],
      empty: false,
      first: false,
      last: false,
      number: 0,
      size: 0,
      numberOfElements: 0,
      totalElements: 0,
      totalPages: 0
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
