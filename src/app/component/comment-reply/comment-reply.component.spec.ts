import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommentReplyComponent } from './comment-reply.component';

describe('CommentReplyComponent', () => {
  let component: CommentReplyComponent;
  let fixture: ComponentFixture<CommentReplyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CommentReplyComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CommentReplyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
