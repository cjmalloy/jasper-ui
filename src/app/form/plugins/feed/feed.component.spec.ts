import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeedFormComponent } from './feed.component';

describe('FeedFormComponent', () => {
  let component: FeedFormComponent;
  let fixture: ComponentFixture<FeedFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FeedFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FeedFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
