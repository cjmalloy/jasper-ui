import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageFormComponent } from './image.component';

describe('ImageComponent', () => {
  let component: ImageFormComponent;
  let fixture: ComponentFixture<ImageFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ImageFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ImageFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
