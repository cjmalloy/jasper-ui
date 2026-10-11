/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListEditorComponent } from './list-editor.component';

describe('ListEditorComponent', () => {
  let component: ListEditorComponent;
  let fixture: ComponentFixture<ListEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [ListEditorComponent]
})
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ListEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the input array immutable and resets local edits on a new input', () => {
    const original = ['first'];
    fixture.componentRef.setInput('list', original);
    fixture.detectChanges();
    component.addingText.set('second');
    component.add();
    expect(original).toEqual(['first']);
    expect(component.list()).toEqual(['first', 'second']);
    component.remove(0);
    expect(original).toEqual(['first']);
    expect(component.list()).toEqual(['second']);
    fixture.componentRef.setInput('list', ['replacement']);
    fixture.detectChanges();
    expect(component.list()).toEqual(['replacement']);
  });
});
