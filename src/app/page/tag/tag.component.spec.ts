import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagPage } from './tag.component';

describe('TagComponent', () => {
  let component: TagPage;
  let fixture: ComponentFixture<TagPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TagPage],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TagPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
