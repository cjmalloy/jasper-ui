import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThumbnailFormComponent } from './thumbnail.component';

describe('ThumbnailComponent', () => {
  let component: ThumbnailFormComponent;
  let fixture: ComponentFixture<ThumbnailFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ThumbnailFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ThumbnailFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
