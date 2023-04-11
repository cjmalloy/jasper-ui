import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommentThreadComponent } from './comment-thread.component';
import { HttpClientTestingModule } from "@angular/common/http/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { Subject } from "rxjs";

describe('CommentThreadComponent', () => {
  let component: CommentThreadComponent;
  let fixture: ComponentFixture<CommentThreadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CommentThreadComponent ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommentThreadComponent);
    component = fixture.componentInstance;
    component.newComments$ = new Subject();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
