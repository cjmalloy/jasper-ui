import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatEntryComponent } from './chat-entry.component';

describe('ChatEntryComponent', () => {
  let component: ChatEntryComponent;
  let fixture: ComponentFixture<ChatEntryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ChatEntryComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatEntryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
