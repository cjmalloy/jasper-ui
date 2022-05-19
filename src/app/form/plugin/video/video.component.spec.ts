import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoFormComponent } from './video.component';

describe('VideoComponent', () => {
  let component: VideoFormComponent;
  let fixture: ComponentFixture<VideoFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VideoFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VideoFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
