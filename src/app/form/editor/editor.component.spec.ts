import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { UntypedFormControl } from '@angular/forms';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { EditorComponent } from './editor.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('EditorComponent', () => {
  let component: EditorComponent;
  let fixture: ComponentFixture<EditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [EditorComponent],
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
    schemas: [NO_ERRORS_SCHEMA]
})
    .compileComponents();

    fixture = TestBed.createComponent(EditorComponent);
    component = fixture.componentInstance;
    component.control = new UntypedFormControl();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty uploads array', () => {
    expect(component.uploads).toEqual([]);
  });

  it('should have hasActiveUploads method that returns false when no uploads', () => {
    expect(component.hasActiveUploads()).toBeFalsy();
  });

  it('should have hasActiveUploads method that returns true when active uploads exist', () => {
    component.uploads = [
      { id: '1', name: 'test.pdf', progress: 50, completed: false },
      { id: '2', name: 'test2.jpg', progress: 100, completed: true }
    ];
    expect(component.hasActiveUploads()).toBeTruthy();
  });

  it('should cancel individual upload correctly', () => {
    const mockSubscription = jasmine.createSpyObj('Subscription', ['unsubscribe']);
    component.uploads = [
      { id: '1', name: 'test.pdf', progress: 50, subscription: mockSubscription },
      { id: '2', name: 'test2.jpg', progress: 75 }
    ];

    component.cancelUpload(component.uploads[0]);

    expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    expect(component.uploads.length).toBe(1);
    expect(component.uploads[0].id).toBe('2');
  });

  it('should cancel all uploads correctly', () => {
    const mockSubscription1 = jasmine.createSpyObj('Subscription', ['unsubscribe']);
    const mockSubscription2 = jasmine.createSpyObj('Subscription', ['unsubscribe']);
    component.uploads = [
      { id: '1', name: 'test.pdf', progress: 50, subscription: mockSubscription1 },
      { id: '2', name: 'test2.jpg', progress: 75, subscription: mockSubscription2 }
    ];

    component.cancelAllUploads();

    expect(mockSubscription1.unsubscribe).toHaveBeenCalled();
    expect(mockSubscription2.unsubscribe).toHaveBeenCalled();
    expect(component.uploads.length).toBe(0);
  });

  it('should append new uploads when there are active uploads', () => {
    // Setup existing uploads with one active
    component.uploads = [
      { id: '1', name: 'existing.pdf', progress: 50, completed: false },
      { id: '2', name: 'completed.jpg', progress: 100, completed: true }
    ];

    // Mock the upload$ method to avoid real HTTP requests
    spyOn(component, 'upload$').and.returnValue(of(null));

    // Mock file list for new upload
    const file1 = new File(['test'], 'new1.txt', { type: 'text/plain' });
    const file2 = new File(['test'], 'new2.txt', { type: 'text/plain' });
    const fileList = [file1, file2] as any as FileList;

    component.upload(fileList);

    // Should have 4 uploads total (2 existing + 2 new)
    expect(component.uploads.length).toBe(4);
    expect(component.uploads[0].name).toBe('existing.pdf');
    expect(component.uploads[1].name).toBe('completed.jpg');
    expect(component.uploads[2].name).toBe('new1.txt');
    expect(component.uploads[3].name).toBe('new2.txt');
  });

  it('should clear uploads when no active uploads exist', () => {
    // Setup existing uploads with all completed
    component.uploads = [
      { id: '1', name: 'completed1.pdf', progress: 100, completed: true },
      { id: '2', name: 'completed2.jpg', progress: 100, completed: true }
    ];

    // Mock the upload$ method to avoid real HTTP requests
    spyOn(component, 'upload$').and.returnValue(of(null));

    // Mock file list for new upload
    const file = new File(['test'], 'new.txt', { type: 'text/plain' });
    const fileList = [file] as any as FileList;

    component.upload(fileList);

    // Should have only 1 upload (the new one, previous completed ones cleared)
    expect(component.uploads.length).toBe(1);
    expect(component.uploads[0].name).toBe('new.txt');
  });
});
