import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadRefComponent } from './upload-ref.component';

describe('UploadRefComponent', () => {
  let component: UploadRefComponent;
  let fixture: ComponentFixture<UploadRefComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UploadRefComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadRefComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
