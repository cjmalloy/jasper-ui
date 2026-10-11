/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { AdminService } from '../../../service/admin.service';

import { CommentReplyComponent } from './comment-reply.component';

describe('CommentReplyComponent', () => {
  let component: CommentReplyComponent;
  let fixture: ComponentFixture<CommentReplyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommentReplyComponent],
      providers: [
        { provide: AdminService, useValue: {
            getPlugin: () => null,
            getPlugins: () => [],
            getEditorButtons: () => [],
            getTemplate: () => null,
          }
        },
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentReplyComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('to', { url: '' });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('tracks pending replies as booleans and cancels the request', () => {
    const request = new Subject<string>();
    vi.spyOn(component['refs'], 'create').mockReturnValue(request);
    component.comment().setValue('Reply text');
    component.reply();
    expect(component.replying()).toBe(true);
    expect(component.comment().disabled).toBe(true);
    component.cancel();
    expect(request.observed).toBe(false);
    expect(component.replying()).toBe(false);
    expect(component.comment().enabled).toBe(true);
  });
});
