import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageControlsComponent } from './page-controls.component';

describe('PageControlsComponent', () => {
  let component: PageControlsComponent;
  let fixture: ComponentFixture<PageControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PageControlsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PageControlsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
