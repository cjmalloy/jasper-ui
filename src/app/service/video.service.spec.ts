/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { VideoService } from './video.service';
import { Store } from '../store/store';
import { StompService } from './api/stomp.service';
import { TaggingService } from './api/tagging.service';
import { RefService } from './api/ref.service';
import { Ref } from '../model/ref';
import { Page } from '../model/page';

// Constants for test timing
const ASYNC_OPERATION_WAIT_MS = 150;
const QUICK_OPERATION_WAIT_MS = 50;

describe('VideoService', () => {
  let service: VideoService;
  let mockStore: any;
  let mockStomp: any;
  let mockTagging: any;
  let mockRefs: any;
  let mockPeerConnection: any;
  let mockMediaStream: any;

  beforeEach(() => {
    // Create mock MediaStream
    mockMediaStream = {
      getTracks: vi.fn().mockReturnValue([]),
    };

    // Create mock RTCPeerConnection
    mockPeerConnection = {
      addEventListener: vi.fn(),
      createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
      createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-answer-sdp' }),
      setLocalDescription: vi.fn().mockResolvedValue(undefined),
      setRemoteDescription: vi.fn().mockResolvedValue(undefined),
      addTrack: vi.fn(),
      addIceCandidate: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
      connectionState: 'new',
    };

    // Create mock Store with video store
    const videoStore = {
      peers: new Map<string, RTCPeerConnection>(),
      streams: new Map<string, MediaStream[]>(),
      stream: undefined,
      call: vi.fn(),
      addStream: vi.fn(),
      hangup: vi.fn(),
    };
    mockStore = {
      video: videoStore,
      account: { tag: 'user/test' },
    };

    // Create mock StompService
    mockStomp = {
      watchResponse: vi.fn().mockReturnValue(of()),
    };

    // Create mock TaggingService
    mockTagging = {
      getResponse: vi.fn().mockReturnValue(of({
        url: 'test-url',
        origin: '',
      } as Ref)),
    };

    // Create mock RefService
    mockRefs = {
      page: vi.fn().mockReturnValue(of(Page.of([]))),
      getCurrent: vi.fn(),
      update: vi.fn().mockReturnValue(of({ url: 'test-url', origin: '' } as Ref)),
    };

    // Mock RTCPeerConnection constructor
    vi.stubGlobal('RTCPeerConnection', vi.fn(() => mockPeerConnection));
    
    // Mock RTCSessionDescription constructor
    vi.stubGlobal('RTCSessionDescription', vi.fn((init: any) => init));

    TestBed.configureTestingModule({
      providers: [
        VideoService,
        { provide: Store, useValue: mockStore },
        { provide: StompService, useValue: mockStomp },
        { provide: TaggingService, useValue: mockTagging },
        { provide: RefService, useValue: mockRefs },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
    });
    service = TestBed.inject(VideoService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('peer connection creation', () => {
    it('should create a new peer connection for a user', () => {
      const user = 'user/alice';
      const peer = service.peer(user);

      expect(peer).toBe(mockPeerConnection);
      expect(mockStore.video.call).toHaveBeenCalledWith(user, mockPeerConnection);
    });

    it('should return existing peer connection if already created', () => {
      const user = 'user/alice';
      mockStore.video.peers.set(user, mockPeerConnection);

      const peer = service.peer(user);

      expect(peer).toBe(mockPeerConnection);
      expect(mockStore.video.call).not.toHaveBeenCalled();
    });

    it('should add tracks from local stream to peer connection', () => {
      const user = 'user/alice';
      const mockTrack = {} as MediaStreamTrack;
      mockMediaStream.getTracks.mockReturnValue([mockTrack]);
      
      service.call('test-query', '', mockMediaStream);
      service.peer(user);

      expect(mockPeerConnection.addTrack).toHaveBeenCalledWith(mockTrack, mockMediaStream);
    });

    it('should set up ice candidate event listener', () => {
      const user = 'user/alice';
      service.peer(user);

      expect(mockPeerConnection.addEventListener).toHaveBeenCalledWith('icecandidate', expect.any(Function));
    });

    it('should set up connection state change event listener', () => {
      const user = 'user/alice';
      service.peer(user);

      expect(mockPeerConnection.addEventListener).toHaveBeenCalledWith('connectionstatechange', expect.any(Function));
    });

    it('should set up track event listener', () => {
      const user = 'user/alice';
      service.peer(user);

      expect(mockPeerConnection.addEventListener).toHaveBeenCalledWith('track', expect.any(Function));
    });
  });

  describe('offer/answer exchange', () => {
    it('should create and send offer when calling', async () => {
      const query = 'test-query';
      const responseOf = 'test-response';
      const mockOffer = { type: 'offer', sdp: 'mock-sdp' } as RTCSessionDescriptionInit;
      const mockRef: Ref = {
        url: 'tag:/user/alice?plugin/user/video',
        origin: '',
        tags: ['plugin/user/video'],
      };
      const mockPage: Page<Ref> = Page.of([mockRef]);

      mockRefs.page.mockReturnValue(of(mockPage));
      mockPeerConnection.createOffer.mockResolvedValue(mockOffer);

      service.call(query, responseOf, mockMediaStream);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, ASYNC_OPERATION_WAIT_MS));
      
      expect(mockPeerConnection.createOffer).toHaveBeenCalled();
      expect(mockPeerConnection.setLocalDescription).toHaveBeenCalledWith(mockOffer);
    });

    it('should handle incoming offer and create answer', async () => {
      const query = 'test-query';
      const mockOffer = { type: 'offer', sdp: 'mock-sdp' } as RTCSessionDescriptionInit;
      const mockAnswer = { type: 'answer', sdp: 'mock-answer-sdp' } as RTCSessionDescriptionInit;
      const mockRef: Ref = {
        url: 'tag:/user/alice?plugin/user/video',
        origin: '',
        tags: ['plugin/user/video'],
        plugins: {
          'plugin/user/video': {
            offer: mockOffer,
          },
        },
      };

      mockStomp.watchResponse.mockReturnValue(of('test-url'));
      mockRefs.getCurrent.mockReturnValue(of(mockRef));
      mockPeerConnection.createAnswer.mockResolvedValue(mockAnswer);

      service.call(query, '', mockMediaStream);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, ASYNC_OPERATION_WAIT_MS));
      
      expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalled();
      expect(mockPeerConnection.createAnswer).toHaveBeenCalled();
      expect(mockPeerConnection.setLocalDescription).toHaveBeenCalledWith(mockAnswer);
    });

    it('should handle incoming answer', async () => {
      const mockAnswer = { type: 'answer', sdp: 'mock-answer-sdp' } as RTCSessionDescriptionInit;
      const mockRef: Ref = {
        url: 'tag:/user/alice?plugin/user/video',
        origin: '',
        tags: ['plugin/user/video'],
        plugins: {
          'plugin/user/video': {
            answer: mockAnswer,
          },
        },
      };

      mockStomp.watchResponse.mockReturnValue(of('test-url'));
      mockRefs.getCurrent.mockReturnValue(of(mockRef));

      service.call('test-query', '', mockMediaStream);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, ASYNC_OPERATION_WAIT_MS));
      
      expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalled();
    });
  });

  describe('ICE candidate handling', () => {
    it('should send ICE candidates when generated', async () => {
      const user = 'user/alice';
      const mockCandidate = { 
        candidate: 'mock-candidate', 
        sdpMid: '0',
        toJSON: vi.fn().mockReturnValue({ candidate: 'mock-candidate', sdpMid: '0' })
      } as any;
      let iceCandidateHandler: ((event: RTCPeerConnectionIceEvent) => void) | undefined;

      mockPeerConnection.addEventListener.mockImplementation((event: string, handler: any) => {
        if (event === 'icecandidate') {
          iceCandidateHandler = handler;
        }
      });

      service.peer(user);

      expect(iceCandidateHandler).toBeDefined();
      
      // Simulate ICE candidate event
      const mockEvent = { candidate: mockCandidate } as RTCPeerConnectionIceEvent;
      iceCandidateHandler!(mockEvent);

      // Wait for async operations to queue the candidate
      await new Promise(resolve => setTimeout(resolve, QUICK_OPERATION_WAIT_MS));

      // Verify candidate toJSON was called (meaning the candidate was processed)
      expect(mockCandidate.toJSON).toHaveBeenCalled();
    });

    it('should handle incoming ICE candidates', async () => {
      const mockCandidate = { candidate: 'mock-candidate', sdpMid: '0' } as RTCIceCandidate;
      const mockRef: Ref = {
        url: 'tag:/user/alice?plugin/user/video',
        origin: '',
        tags: ['plugin/user/video'],
        plugins: {
          'plugin/user/video': {
            candidate: [mockCandidate],
          },
        },
      };

      mockStomp.watchResponse.mockReturnValue(of('test-url'));
      mockRefs.getCurrent.mockReturnValue(of(mockRef));

      service.call('test-query', '', mockMediaStream);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, ASYNC_OPERATION_WAIT_MS));
      
      expect(mockPeerConnection.addIceCandidate).toHaveBeenCalledWith(mockCandidate);
    });

    it('should handle errors when adding ICE candidates', async () => {
      const mockCandidate = { candidate: 'mock-candidate', sdpMid: '0' } as RTCIceCandidate;
      const mockRef: Ref = {
        url: 'tag:/user/alice?plugin/user/video',
        origin: '',
        tags: ['plugin/user/video'],
        plugins: {
          'plugin/user/video': {
            candidate: [mockCandidate],
          },
        },
      };

      mockStomp.watchResponse.mockReturnValue(of('test-url'));
      mockRefs.getCurrent.mockReturnValue(of(mockRef));
      mockPeerConnection.addIceCandidate.mockImplementation(() => {
        throw new Error('Invalid candidate');
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      service.call('test-query', '', mockMediaStream);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, ASYNC_OPERATION_WAIT_MS));
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error adding received ice candidate', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('conflict resolution on 409 errors', () => {
    it('should handle 409 conflict by resetting state', async () => {
      const mockRef: Ref = {
        url: 'test-url',
        origin: '',
        tags: ['plugin/user/video'],
        plugins: {},
      };

      mockTagging.getResponse.mockReturnValue(of(mockRef));
      mockRefs.update.mockReturnValue(throwError(() => ({ status: 409 })));

      service.send({ type: 'offer', payload: { type: 'offer', sdp: 'mock-sdp' } });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, ASYNC_OPERATION_WAIT_MS));
      
      // Should have attempted to update at least once
      expect(mockRefs.update).toHaveBeenCalled();
    });

    it('should preserve video data on 409 conflict', async () => {
      const mockRef: Ref = {
        url: 'test-url',
        origin: '',
        tags: ['plugin/user/video'],
        plugins: {
          'plugin/user/video': { existing: 'data' },
        },
      };

      mockTagging.getResponse.mockReturnValue(of(mockRef));
      mockRefs.update.mockReturnValue(throwError(() => ({ status: 409 })));

      service.send({ type: 'offer', payload: { type: 'offer', sdp: 'mock-sdp' } });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, ASYNC_OPERATION_WAIT_MS));
      
      // After 409, video data should be set from the ref
      expect(service['video']).toBeDefined();
    });

    it('should handle non-409 errors gracefully', async () => {
      const mockRef: Ref = {
        url: 'test-url',
        origin: '',
        tags: ['plugin/user/video'],
        plugins: {},
      };

      mockTagging.getResponse.mockReturnValue(of(mockRef));
      mockRefs.update.mockReturnValue(throwError(() => ({ status: 500, message: 'Server error' })));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      service.send({ type: 'offer', payload: { type: 'offer', sdp: 'mock-sdp' } });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, ASYNC_OPERATION_WAIT_MS));
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('cleanup on hangup', () => {
    it('should clear query and responseOf on hangup', () => {
      service.query = 'test-query';
      service.responseOf = 'test-response';

      service.hangup();

      expect(service.query).toBe('');
      expect(service.responseOf).toBe('');
    });

    it('should call store.video.hangup on hangup', () => {
      service.hangup();

      expect(mockStore.video.hangup).toHaveBeenCalled();
    });

    it('should trigger destroy$ subject on hangup', () => {
      const destroySpy = vi.fn();
      service['destroy$'].subscribe(destroySpy);

      service.hangup();

      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('subscription management', () => {
    let freshMockStore: any;
    
    beforeEach(() => {
      // Create a completely fresh mock store for these tests
      const videoStore = {
        peers: new Map<string, RTCPeerConnection>(),
        streams: new Map<string, MediaStream[]>(),
        stream: undefined,
        call: vi.fn(),
        addStream: vi.fn(),
        hangup: vi.fn(),
      };
      freshMockStore = {
        video: videoStore,
        account: { tag: 'user/test' },
      };
      
      // Replace the service's store reference
      (service as any).store = freshMockStore;
      
      // Reset service state
      service.query = '';
      service.responseOf = '';
    });

    it('should stop previous subscription when calling with different parameters', () => {
      const mockRef1: Ref = {
        url: 'tag:/user/alice?plugin/user/video',
        origin: '',
        tags: ['plugin/user/video'],
      };
      const mockPage1: Page<Ref> = Page.of([mockRef1]);

      mockRefs.page.mockReturnValue(of(mockPage1));

      // First call
      service.call('query1', 'response1', mockMediaStream);
      const firstDestroySpy = vi.fn();
      service['destroy$'].subscribe(firstDestroySpy);

      // Second call with different parameters
      service.call('query2', 'response2', mockMediaStream);

      expect(firstDestroySpy).toHaveBeenCalled();
    });

    it('should not create new subscription when calling with same parameters', () => {
      const query = 'test-query';
      const responseOf = 'test-response';
      
      service.query = query;
      service.responseOf = responseOf;

      const pageCallCount = mockRefs.page.mock.calls.length;

      service.call(query, responseOf, mockMediaStream);

      expect(mockRefs.page.mock.calls.length).toBe(pageCallCount);
    });

    it('should filter out own user from peer connections', () => {
      const mockRef1: Ref = {
        url: 'tag:/user/test?plugin/user/video', // Proper format - Same as store.account.tag
        origin: '',
        tags: ['plugin/user/video'],
      };
      const mockRef2: Ref = {
        url: 'tag:/user/alice?plugin/user/video', // Proper format
        origin: '',
        tags: ['plugin/user/video'],
      };
      const mockPage: Page<Ref> = Page.of([mockRef1, mockRef2]);

      mockRefs.page.mockReturnValue(of(mockPage));

      service.call('test-query', '', mockMediaStream);

      // Should only create peer for alice, not for self (test user)
      expect(freshMockStore.video.call).toHaveBeenCalledTimes(1);
      expect(freshMockStore.video.call).toHaveBeenCalledWith('user/alice', expect.anything());
    });
  });

  describe('stream handling', () => {
    it('should add remote stream to store when track event fires', () => {
      const user = 'user/alice';
      const mockRemoteStream = {
        getTracks: vi.fn(),
      };
      let trackHandler: ((event: RTCTrackEvent) => void) | undefined;

      mockPeerConnection.addEventListener.mockImplementation((event: string, handler: any) => {
        if (event === 'track') {
          trackHandler = handler;
        }
      });

      service.peer(user);

      expect(trackHandler).toBeDefined();

      // Simulate track event
      const mockEvent = { streams: [mockRemoteStream] } as any;
      trackHandler!(mockEvent);

      expect(mockStore.video.addStream).toHaveBeenCalledWith(user, mockRemoteStream);
    });
  });
});
