import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AudioUploadComponent } from './audio-upload.component';

describe('AudioUploadComponent', () => {
  let component: AudioUploadComponent;
  let fixture: ComponentFixture<AudioUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AudioUploadComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AudioUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
