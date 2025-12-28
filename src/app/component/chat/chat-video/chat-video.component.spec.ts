/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Ref } from '../../../model/ref';
import { TaggingService } from '../../../service/api/tagging.service';
import { VideoService } from '../../../service/video.service';
import { Store } from '../../../store/store';

import { ChatVideoComponent } from './chat-video.component';

describe('ChatVideoComponent', () => {
  let component: ChatVideoComponent;
  let fixture: ComponentFixture<ChatVideoComponent>;
  let mockTaggingService: any;
  let mockVideoService: any;
  let mockStore: Store;
  let mockGetUserMedia: any;
  let mockMediaStream: MediaStream;

  beforeEach(async () => {
    mockTaggingService = {
      getResponse: vi.fn(),
      respond: vi.fn(),
      deleteResponse: vi.fn()
    };
    mockVideoService = {
      call: vi.fn(),
      hangup: vi.fn()
    };
    
    // Create a mock MediaStream
    const mockStop = vi.fn();
    mockMediaStream = {
      getTracks: vi.fn().mockReturnValue([{ stop: mockStop }])
    } as any;

    // Mock navigator.mediaDevices.getUserMedia
    mockGetUserMedia = vi.fn().mockResolvedValue(mockMediaStream);
    if (!navigator.mediaDevices) {
      (navigator as any).mediaDevices = {};
    }
    navigator.mediaDevices.getUserMedia = mockGetUserMedia;

    await TestBed.configureTestingModule({
      imports: [ChatVideoComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: TaggingService, useValue: mockTaggingService },
        { provide: VideoService, useValue: mockVideoService },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatVideoComponent);
    component = fixture.componentInstance;
    mockStore = TestBed.inject(Store);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Automatic call initiation', () => {
    it('should automatically call when plugin/user/video tag is detected and video is not enabled', () => {
      mockStore.video.enabled = false;
      const mockRef: Ref = {
        url: 'test://url',
        origin: '',
        tags: ['plugin/user/video']
      };
      mockTaggingService.getResponse.mockReturnValue(of(mockRef));
      mockTaggingService.respond.mockReturnValue(of(undefined));

      vi.spyOn(component, 'call');
      
      fixture.detectChanges();

      expect(mockTaggingService.getResponse).toHaveBeenCalledWith('tag:/chat');
      expect(component.call).toHaveBeenCalled();
    });

    it('should not call when video is already enabled', () => {
      mockStore.video.enabled = true;
      
      vi.spyOn(component, 'call');
      
      fixture.detectChanges();

      expect(mockTaggingService.getResponse).not.toHaveBeenCalled();
      expect(component.call).not.toHaveBeenCalled();
    });

    it('should use responseOf URL if provided', () => {
      mockStore.video.enabled = false;
      component.responseOf = { url: 'test://response', origin: '' } as Ref;
      mockTaggingService.getResponse.mockReturnValue(of({} as Ref));

      fixture.detectChanges();

      expect(mockTaggingService.getResponse).toHaveBeenCalledWith('test://response');
    });
  });

  describe('Enabling video', () => {
    beforeEach(() => {
      mockTaggingService.respond.mockReturnValue(of(undefined));
    });

    it('should enable video when call() is invoked', async () => {
      mockStore.video.enabled = false;

      await component.call();

      expect(mockStore.video.enabled).toBe(true);
    });

    it('should request media permissions with audio and video', async () => {
      await component.call();

      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true, video: true });
    });

    it('should call TaggingService.respond with correct tags', async () => {
      await component.call();

      expect(mockTaggingService.respond).toHaveBeenCalledWith(
        ['public', 'plugin/user/video'],
        'tag:/chat'
      );
    });

    it('should call VideoService with the stream', async () => {
      await component.call();
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for promise to resolve

      expect(mockVideoService.call).toHaveBeenCalledWith('chat', '', mockMediaStream);
    });
  });

  describe('Handling getUserMedia errors', () => {
    beforeEach(() => {
      mockTaggingService.respond.mockReturnValue(of(undefined));
    });

    it('should handle getUserMedia errors gracefully', async () => {
      const mockError = new Error('Permission denied');
      mockGetUserMedia.mockRejectedValue(mockError);
      vi.spyOn(console, 'log');

      await component.call();
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for promise to reject

      expect(console.log).toHaveBeenCalledWith('Raised error when capturing:', mockError);
    });

    it('should not call VideoService when getUserMedia fails', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

      await component.call();
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for promise to reject

      expect(mockVideoService.call).not.toHaveBeenCalled();
    });
  });

  describe('Stream cleanup', () => {
    beforeEach(() => {
      mockTaggingService.respond.mockReturnValue(of(undefined));
    });

    it('should stop stream tracks if video is disabled before stream is obtained', async () => {
      mockStore.video.enabled = false;
      
      const callPromise = component.call();
      mockStore.video.enabled = false; // Disable before getUserMedia resolves
      
      await callPromise;
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for promise to resolve

      expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
    });

    it('should not call VideoService if video is disabled before stream is obtained', async () => {
      const callPromise = component.call();
      mockStore.video.enabled = false; // Disable before getUserMedia resolves
      
      await callPromise;
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for promise to resolve

      expect(mockVideoService.call).not.toHaveBeenCalled();
    });
  });

  describe('Disabling video', () => {
    beforeEach(() => {
      mockTaggingService.deleteResponse.mockReturnValue(of(undefined));
    });

    it('should disable video when hangup() is invoked', () => {
      mockStore.video.enabled = true;

      component.hangup();

      expect(mockStore.video.enabled).toBe(false);
    });

    it('should call TaggingService.deleteResponse', () => {
      component.hangup();

      expect(mockTaggingService.deleteResponse).toHaveBeenCalledWith(
        'plugin/user/video',
        'tag:/chat'
      );
    });

    it('should call VideoService.hangup', () => {
      component.hangup();

      expect(mockVideoService.hangup).toHaveBeenCalled();
    });

    it('should use responseOf URL when provided', () => {
      component.responseOf = { url: 'test://response', origin: '' } as Ref;

      component.hangup();

      expect(mockTaggingService.deleteResponse).toHaveBeenCalledWith(
        'plugin/user/video',
        'test://response'
      );
    });
  });

  describe('User streams', () => {
    it('should return user streams from store', () => {
      const mockStream1 = {} as MediaStream;
      const mockStream2 = {} as MediaStream;
      mockStore.video.streams.set('user1', [mockStream1]);
      mockStore.video.streams.set('user2', [mockStream2]);

      const userStreams = component.userStreams;

      expect(userStreams.length).toBe(2);
      expect(userStreams[0].tag).toBe('user1');
      expect(userStreams[0].streams).toEqual([mockStream1]);
      expect(userStreams[1].tag).toBe('user2');
      expect(userStreams[1].streams).toEqual([mockStream2]);
    });

    it('should return empty array when no streams', () => {
      mockStore.video.streams.clear();

      const userStreams = component.userStreams;

      expect(userStreams.length).toBe(0);
    });
  });
});
