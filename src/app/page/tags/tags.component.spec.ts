import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagsPage } from './tags.component';

describe('TagsComponent', () => {
  let component: TagsPage;
  let fixture: ComponentFixture<TagsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TagsPage ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TagsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
