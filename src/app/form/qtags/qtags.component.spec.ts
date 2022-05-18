import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QtagsComponent } from './qtags.component';

describe('QtagsComponent', () => {
  let component: QtagsComponent;
  let fixture: ComponentFixture<QtagsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QtagsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QtagsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
