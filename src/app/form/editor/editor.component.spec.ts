import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { UntypedFormControl } from '@angular/forms';
import { NO_ERRORS_SCHEMA } from '@angular/core';

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
    component.uploading = true;

    component.cancelAllUploads();

    expect(mockSubscription1.unsubscribe).toHaveBeenCalled();
    expect(mockSubscription2.unsubscribe).toHaveBeenCalled();
    expect(component.uploads.length).toBe(0);
    expect(component.uploading).toBeFalsy();
  });
});
