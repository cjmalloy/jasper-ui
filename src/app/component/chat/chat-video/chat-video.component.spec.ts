/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { VideoService } from '../../../service/video.service';
import { Store } from '../../../store/store';

import { ChatVideoComponent } from './chat-video.component';

describe('ChatVideoComponent', () => {
  let component: ChatVideoComponent;
  let fixture: ComponentFixture<ChatVideoComponent>;
  let mockAdminService: any;
  let mockTaggingService: any;
  let mockVideoService: any;
  let mockStore: Store;
  let mockGetUserMedia: any;
  let mockMediaStream: MediaStream;

  beforeEach(async () => {
    mockAdminService = {
      getPlugin: vi.fn().mockReturnValue({
        config: {
          gumConfig: { 
            audio: true, 
            video: { width: { ideal: 640 }, height: { ideal: 640 } } 
          }
        }
      })
    };
    mockTaggingService = {
      getResponse: vi.fn().mockReturnValue(of({})),
      respond: vi.fn().mockReturnValue(of(undefined)),
      deleteResponse: vi.fn().mockReturnValue(of(undefined)),
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
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AdminService, useValue: mockAdminService },
        { provide: ExtService, useValue: {
          getCachedExt: vi.fn().mockImplementation(tag => of({ tag, origin: '' })),
        } },
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
    it('should automatically call when plugin/user/lobby tag is detected and video is not enabled', () => {
      // Setup localStorage to indicate user was in a call
      localStorage.setItem('video', 'true');
      mockStore.video.enabled.set(false);
      const mockRef: Ref = {
        url: 'test://url',
        origin: '',
        tags: ['plugin/user/lobby']
      };
      mockTaggingService.getResponse.mockReturnValue(of(mockRef));
      mockTaggingService.respond.mockReturnValue(of(undefined));
      mockTaggingService.deleteResponse.mockReturnValue(of(undefined));

      vi.spyOn(component, 'call');
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      fixture.detectChanges();

      expect(mockTaggingService.getResponse).toHaveBeenCalledWith('tag:/chat');
      expect(component.call).toHaveBeenCalled();
    });

    it('should not call when video is already enabled', () => {
      mockStore.video.enabled.set(true);

      vi.spyOn(component, 'call');

      fixture.detectChanges();

      expect(mockTaggingService.getResponse).not.toHaveBeenCalled();
      expect(component.call).not.toHaveBeenCalled();
    });

    it('should use custom URL if provided', () => {
      // Setup localStorage to indicate user was in a call
      localStorage.setItem('video', 'true');
      mockStore.video.enabled.set(false);
      fixture.componentRef.setInput('url', 'test://response');
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
      mockStore.video.enabled.set(false);

      await component.call();

      expect(mockStore.video.enabled()).toBe(true);
    });

    it('should request media permissions with audio and video', async () => {
      await component.call();

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 }
        }
      });
    });

    it('should call TaggingService.respond with correct tags', async () => {
      await component.call();

      expect(mockTaggingService.respond).toHaveBeenCalledWith(
        ['public', 'plugin/user/lobby'],
        'tag:/chat'
      );
    });

    it('should call VideoService with the stream', async () => {
      component.call();
      // Wait for getUserMedia promise to resolve and .then() to execute
      await vi.waitFor(() => {
        expect(mockVideoService.call).toHaveBeenCalledWith('tag:/chat', mockMediaStream);
      });
    });
  });

  describe('Handling getUserMedia errors', () => {
    beforeEach(() => {
      mockTaggingService.respond.mockReturnValue(of(undefined));
    });

    it('should handle getUserMedia errors gracefully', async () => {
      const mockError = new Error('Permission denied');
      mockGetUserMedia.mockRejectedValue(mockError);
      const consoleSpy = vi.spyOn(console, 'log');

      component.call();
      // Wait for getUserMedia promise to reject and .catch() to execute
      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Raised error when capturing:', mockError);
      });
    });

    it('should not call VideoService when getUserMedia fails', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

      component.call();
      // Wait for getUserMedia rejection and .catch() handler to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockVideoService.call).not.toHaveBeenCalled();
    });
  });

  describe('Stream cleanup', () => {
    beforeEach(() => {
      mockTaggingService.respond.mockReturnValue(of(undefined));
    });

    it('should stop stream tracks if video is disabled before stream is obtained', async () => {
      component.call();
      mockStore.video.enabled.set(false); // Disable before getUserMedia resolves

      // Wait for .then() handler to execute and stop the stream
      await vi.waitFor(() => {
        expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
      });
    });

    it('should not call VideoService if video is disabled before stream is obtained', async () => {
      component.call();
      mockStore.video.enabled.set(false); // Disable before getUserMedia resolves

      // Wait for getUserMedia resolution and .then() handler to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockVideoService.call).not.toHaveBeenCalled();
    });

    it('stops captured tracks when destroyed while waiting to join the lobby', async () => {
      const response = new Subject<void>();
      mockTaggingService.respond.mockReturnValue(response);
      component.call();
      await vi.waitFor(() => expect(response.observed).toBe(true));

      fixture.destroy();

      expect(response.observed).toBe(false);
      expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
      expect(mockVideoService.call).not.toHaveBeenCalled();
    });

    it('stops tracks obtained after the component is destroyed', async () => {
      component.call();
      fixture.destroy();

      await vi.waitFor(() => expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled());
      expect(mockTaggingService.respond).not.toHaveBeenCalled();
      expect(mockVideoService.call).not.toHaveBeenCalled();
    });
  });

  describe('Disabling video', () => {
    beforeEach(() => {
      mockTaggingService.deleteResponse.mockReturnValue(of(undefined));
    });

    it('should disable video when hangup() is invoked', () => {
      mockStore.video.enabled.set(true);

      component.hangup();

      expect(mockStore.video.enabled()).toBe(false);
    });

    it('should call TaggingService.deleteResponse', () => {
      component.hangup();

      expect(mockTaggingService.deleteResponse).toHaveBeenCalledWith(
        'plugin/user/lobby',
        'tag:/chat'
      );
    });

    it('should call VideoService.hangup', () => {
      component.hangup();

      expect(mockVideoService.hangup).toHaveBeenCalled();
    });

    it('should use custom URL when provided', () => {
      fixture.componentRef.setInput('url', 'test://response');

      component.hangup();

      expect(mockTaggingService.deleteResponse).toHaveBeenCalledWith(
        'plugin/user/lobby',
        'test://response'
      );
    });
  });

  describe('User streams', () => {
    it('invalidates cached live streams through the production track lifecycle notification', () => {
      const track = { readyState: 'live' };
      const stream = { getTracks: () => [track] } as unknown as MediaStream;
      mockStore.video.streams.set(new Map([['user1', [{ stream }]]]));
      const snapshot = mockStore.video.streams();
      expect(component.userStreams()[0].streams).toHaveLength(1);
      expect(component.featuredStream()?.streams).toHaveLength(1);

      track.readyState = 'ended';
      mockStore.video.refreshStreams('user1');

      expect(mockStore.video.streams()).not.toBe(snapshot);
      expect(component.userStreams()[0].streams).toEqual([]);
      expect(component.featuredStream()?.streams).toEqual([]);
      expect(component.gridStreams()).toEqual([]);
    });

    it('should return user streams from store', () => {
      const mockStream1 = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      const mockStream2 = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      mockStore.video.streams.set(new Map([
        ['user1', [{ stream: mockStream1 }]], ['user2', [{ stream: mockStream2 }]],
      ]));

      const userStreams = component.userStreams();

      expect(userStreams.length).toBe(2);
      expect(userStreams[0].tag).toBe('user1');
      expect(userStreams[0].streams).toEqual([{ stream: mockStream1 }]);
      expect(userStreams[1].tag).toBe('user2');
      expect(userStreams[1].streams).toEqual([{ stream: mockStream2 }]);
    });

    it('should return empty array when no streams', () => {
      mockStore.video.streams.set(new Map());

      const userStreams = component.userStreams();

      expect(userStreams.length).toBe(0);
    });

    it('should correctly detect live and non-live streams', () => {
      const liveStream = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      const endedStream = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'ended' }])
      } as any as MediaStream;
      mockStore.video.streams.set(new Map([['user1', [{ stream: liveStream }, { stream: endedStream }]]]));

      const userStreams = component.userStreams();

      // Only live streams should be returned (filtered)
      expect(userStreams[0].streams).toEqual([{ stream: liveStream }]);
    });
  });

  describe('isTwoPersonCall', () => {
    it('should return true when there is exactly one remote stream', () => {
      const mockStream = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      mockStore.video.streams.set(new Map([['user1', [{ stream: mockStream }]]]));

      expect(component.isTwoPersonCall()).toBe(true);
    });

    it('should return false when there are no streams', () => {
      mockStore.video.streams.set(new Map());

      expect(component.isTwoPersonCall()).toBe(false);
    });

    it('should return false when there are multiple streams', () => {
      const mockStream1 = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      const mockStream2 = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      mockStore.video.streams.set(new Map([
        ['user1', [{ stream: mockStream1 }]], ['user2', [{ stream: mockStream2 }]],
      ]));

      expect(component.isTwoPersonCall()).toBe(false);
    });
  });

  describe('featuredStream', () => {
    it('should return the only stream when there is one stream', () => {
      const mockStream = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      mockStore.video.streams.set(new Map([['user1', [{ stream: mockStream }]]]));

      const featured = component.featuredStream()!;

      expect(featured.tag).toBe('user1');
      expect(featured.streams).toEqual([{ stream: mockStream }]);
    });

    it('should return first stream when no active speaker is set', () => {
      const mockStream1 = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      const mockStream2 = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      mockStore.video.streams.set(new Map([
        ['user1', [{ stream: mockStream1 }]], ['user2', [{ stream: mockStream2 }]],
      ]));
      mockStore.video.activeSpeaker.set('');

      const featured = component.featuredStream()!;

      expect(featured.tag).toBe('user1');
    });

    it('should return active speaker stream when set', () => {
      const mockStream1 = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      const mockStream2 = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      mockStore.video.streams.set(new Map([
        ['user1', [{ stream: mockStream1 }]], ['user2', [{ stream: mockStream2 }]],
      ]));
      mockStore.video.activeSpeaker.set('user2');

      const featured = component.featuredStream()!;

      expect(featured.tag).toBe('user2');
      expect(featured.streams).toEqual([{ stream: mockStream2 }]);
    });

    it('should fallback to first stream if active speaker not found', () => {
      const mockStream1 = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      mockStore.video.streams.set(new Map([['user1', [{ stream: mockStream1 }]]]));
      mockStore.video.activeSpeaker.set('nonexistent');

      const featured = component.featuredStream()!;

      expect(featured.tag).toBe('user1');
    });

    it('should return undefined when there are no streams', () => {
      mockStore.video.streams.set(new Map());

      const featured = component.featuredStream();

      expect(featured).toBeUndefined();
    });
  });

  describe('gridStreams', () => {
    it('excludes the fallback featured user when the active speaker has left', () => {
      const stream = { getTracks: () => [{ readyState: 'live' }] } as any as MediaStream;
      mockStore.video.streams.set(new Map([
        ['user1', [{ stream }]], ['user2', [{ stream }]],
      ]));
      mockStore.video.activeSpeaker.set('departed');

      expect(component.featuredStream()?.tag).toBe('user1');
      expect(component.gridStreams().map(user => user.tag)).toEqual(['user2']);
    });

    it('recomputes cached layouts and hungup users after immutable store updates', () => {
      const stream = { getTracks: () => [{ readyState: 'live' }] } as any as MediaStream;
      mockStore.video.streams.set(new Map([['user1', [{ stream }]]]));
      expect(component.isTwoPersonCall()).toBe(true);
      expect(component.gridStreams()).toEqual([]);
      expect(component.hungup()).toEqual([]);

      mockStore.video.streams.update(streams => new Map([...streams, ['user2', [{ stream }]]]));
      mockStore.video.activeSpeaker.set('user2');
      mockStore.video.hungup.set(new Map([['departed', true]]));

      expect(component.isTwoPersonCall()).toBe(false);
      expect(component.featuredStream()?.tag).toBe('user2');
      expect(component.gridStreams().map(user => user.tag)).toEqual(['user1']);
      expect(component.hungup()).toEqual(['departed']);
      mockStore.video.streams.set(new Map());
      expect(component.featuredStream()).toBeUndefined();
      expect(component.gridStreams()).toEqual([]);
    });

    it('should return empty array when there is only one stream', () => {
      const mockStream = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      mockStore.video.streams.set(new Map([['user1', [{ stream: mockStream }]]]));

      const grid = component.gridStreams();

      expect(grid.length).toBe(0);
    });

    it('should return all streams except first when no active speaker', () => {
      const mockStream1 = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      const mockStream2 = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      const mockStream3 = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      mockStore.video.streams.set(new Map([
        ['user1', [{ stream: mockStream1 }]], ['user2', [{ stream: mockStream2 }]],
        ['user3', [{ stream: mockStream3 }]],
      ]));
      mockStore.video.activeSpeaker.set('');

      const grid = component.gridStreams();

      expect(grid.length).toBe(2);
      expect(grid[0].tag).toBe('user2');
      expect(grid[1].tag).toBe('user3');
    });

    it('should return all streams except active speaker', () => {
      const mockStream1 = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      const mockStream2 = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      const mockStream3 = {
        getTracks: vi.fn().mockReturnValue([{ readyState: 'live' }])
      } as any as MediaStream;
      mockStore.video.streams.set(new Map([
        ['user1', [{ stream: mockStream1 }]], ['user2', [{ stream: mockStream2 }]],
        ['user3', [{ stream: mockStream3 }]],
      ]));
      mockStore.video.activeSpeaker.set('user2');

      const grid = component.gridStreams();

      expect(grid.length).toBe(2);
      expect(grid[0].tag).toBe('user1');
      expect(grid[1].tag).toBe('user3');
    });

    it('should return empty array when there are no streams', () => {
      mockStore.video.streams.set(new Map());

      const grid = component.gridStreams();

      expect(grid.length).toBe(0);
    });
  });

  describe('hungup', () => {
    it('should return empty array when no users have hung up', () => {
      mockStore.video.hungup.set(new Map());

      const hungup = component.hungup();

      expect(hungup.length).toBe(0);
    });

    it('should return users who have hung up', () => {
      mockStore.video.hungup.set(new Map([['user1', true], ['user2', false], ['user3', true]]));

      const hungup = component.hungup();

      expect(hungup).toEqual(['user1', 'user3']);
    });

    it('should not include users with false hungup status', () => {
      mockStore.video.hungup.set(new Map([['user1', false]]));

      const hungup = component.hungup();

      expect(hungup.length).toBe(0);
    });
  });

  describe('speaker selection', () => {
    beforeEach(() => {
      mockStore.account.tag.set('+user/me');
    });

    it('should set activeSpeaker to empty string when setting to current user', () => {
      component.setSpeaker('+user/me');

      expect(mockStore.video.activeSpeaker()).toBe('');
    });

    it('should set activeSpeaker to user tag when setting to different user', () => {
      component.setSpeaker('+user/other');

      expect(mockStore.video.activeSpeaker()).toBe('+user/other');
    });
  });
});
