import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QrFormComponent } from './qr.component';

describe('QrComponent', () => {
  let component: QrFormComponent;
  let fixture: ComponentFixture<QrFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QrFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QrFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
