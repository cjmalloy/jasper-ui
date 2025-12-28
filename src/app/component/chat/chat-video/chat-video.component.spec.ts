/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ChatVideoComponent } from './chat-video.component';

describe('ChatVideoComponent', () => {
  let component: ChatVideoComponent;
  let fixture: ComponentFixture<ChatVideoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatVideoComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatVideoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
