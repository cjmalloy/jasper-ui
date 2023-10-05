import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TodoItemComponent } from './item.component';

describe('ItemComponent', () => {
  let component: TodoItemComponent;
  let fixture: ComponentFixture<TodoItemComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TodoItemComponent]
    });
    fixture = TestBed.createComponent(TodoItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
