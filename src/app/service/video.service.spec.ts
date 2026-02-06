/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Page } from '../model/page';
import { Ref } from '../model/ref';
import { Store } from '../store/store';
import { AdminService } from './admin.service';
import { RefService } from './api/ref.service';
import { StompService } from './api/stomp.service';
import { TaggingService } from './api/tagging.service';
import { ConfigService } from './config.service';
import { VideoService } from './video.service';

// Constants for test timing
const ASYNC_OPERATION_WAIT_MS = 150;
const QUICK_OPERATION_WAIT_MS = 50;

describe('VideoService', () => {
  let service: VideoService;
  let mockStore: any;
  let mockStomp: any;
  let mockTagging: any;
  let mockRefs: any;
  let mockAdmin: any;
  let mockConfig: any;
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
      signalingState: 'stable',
      iceConnectionState: 'new',
      localDescription: null,
      remoteDescription: null,
      pendingLocalDescription: null,
      pendingRemoteDescription: null,
    };

    // Create mock Store with video store
    const videoStore = {
      peers: new Map<string, RTCPeerConnection>(),
      streams: new Map<string, MediaStream[]>(),
      stream: undefined,
      hungup: new Map<string, boolean>(),
      call: vi.fn((user: string, peer: RTCPeerConnection) => {
        videoStore.peers.set(user, peer);
        videoStore.streams.set(user, []);
      }),
      addStream: vi.fn(),
      remove: vi.fn(),
      reset: vi.fn(),
      hangup: vi.fn(),
    };
    mockStore = {
      video: videoStore,
      account: { tag: 'user/test', localTag: 'user/test' },
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
      patchResponse: vi.fn().mockReturnValue(of('success')),
      mergeResponse: vi.fn().mockReturnValue(of('success')),
      deleteResponse: vi.fn().mockReturnValue(of(undefined)),
    };

    // Create mock RefService
    mockRefs = {
      page: vi.fn().mockReturnValue(of(Page.of([]))),
      getCurrent: vi.fn(),
      update: vi.fn().mockReturnValue(of({ url: 'test-url', origin: '' } as Ref)),
    };

    // Create mock AdminService
    mockAdmin = {
      getPlugin: vi.fn().mockReturnValue({
        config: {
          rtcConfig: {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
          }
        }
      }),
    };

    // Create mock ConfigService
    mockConfig = {
      websockets: true,
    };

    // Mock RTCPeerConnection constructor
    vi.stubGlobal('RTCPeerConnection', vi.fn(function() { return mockPeerConnection; }));

    // Mock RTCSessionDescription constructor
    vi.stubGlobal('RTCSessionDescription', vi.fn(function(init: any) { return init; }));

    TestBed.configureTestingModule({
      providers: [
        VideoService,
        { provide: Store, useValue: mockStore },
        { provide: StompService, useValue: mockStomp },
        { provide: TaggingService, useValue: mockTagging },
        { provide: RefService, useValue: mockRefs },
        { provide: AdminService, useValue: mockAdmin },
        { provide: ConfigService, useValue: mockConfig },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    service = TestBed.inject(VideoService);
  });

  afterEach(() => {
    // Trigger destroy to stop subscriptions
    service['destroy$'].next();
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('peer connection creation', () => {
    it('should create a new peer connection for a user', () => {
      const user = 'user/alice';
      // Set up the stream so peer() can access it
      mockStore.video.stream = mockMediaStream;
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

      service.call('tag:/chat', mockMediaStream);
      service.peer(user);

      expect(mockPeerConnection.addTrack).toHaveBeenCalledWith(mockTrack, mockMediaStream);
    });

    it('should set up ice candidate event listener', () => {
      const user = 'user/alice';
      // Set up the stream so peer() can access it
      mockStore.video.stream = mockMediaStream;
      service.peer(user);

      expect(mockPeerConnection.addEventListener).toHaveBeenCalledWith('icecandidate', expect.any(Function));
    });

    it('should set up connection state change event listener', () => {
      const user = 'user/alice';
      // Set up the stream so peer() can access it
      mockStore.video.stream = mockMediaStream;
      service.peer(user);

      expect(mockPeerConnection.addEventListener).toHaveBeenCalledWith('connectionstatechange', expect.any(Function));
    });

    it('should set up track event listener', () => {
      const user = 'user/alice';
      // Set up the stream so peer() can access it
      mockStore.video.stream = mockMediaStream;
      service.peer(user);

      expect(mockPeerConnection.addEventListener).toHaveBeenCalledWith('track', expect.any(Function));
    });
  });

  describe('offer/answer exchange', () => {
    it('should create and send offer when calling', async () => {
      const url = 'tag:/chat';
      const mockOffer = { type: 'offer', sdp: 'mock-sdp' } as RTCSessionDescriptionInit;
      const mockRef: Ref = {
        url: 'tag:/user/alice?plugin/user/video',
        origin: '',
        tags: ['plugin/user/video'],
      };
      const mockPage: Page<Ref> = Page.of([mockRef]);

      mockRefs.page.mockReturnValue(of(mockPage));
      mockPeerConnection.createOffer.mockResolvedValue(mockOffer);

      service.call(url, mockMediaStream);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, ASYNC_OPERATION_WAIT_MS));

      expect(mockPeerConnection.createOffer).toHaveBeenCalled();
      expect(mockPeerConnection.setLocalDescription).toHaveBeenCalledWith(mockOffer);
    });

    it('should handle incoming offer and create answer', async () => {
      const url = 'tag:/chat';
      const mockOffer = { type: 'offer', sdp: 'mock-sdp' } as RTCSessionDescriptionInit;
      const mockAnswer = { type: 'answer', sdp: 'mock-answer-sdp' } as RTCSessionDescriptionInit;
      const mockRef: Ref = {
        url: 'tag:/user/alice?plugin/user/video',
        origin: '',
        tags: ['plugin/user/video', 'plugin/user/lobby'],
        plugins: {
          'plugin/user/video': {
            offer: mockOffer,
          },
        },
      };

      // Mock watchResponse to emit the ref URL for the correct tag
      mockStomp.watchResponse.mockImplementation((responseUrl: string) => {
        if (responseUrl === 'tag:/user/test') {
          return of('tag:/user/alice?plugin/user/video');
        }
        if (responseUrl === 'tag:/chat') {
          return of('tag:/user/alice?plugin/user/video');
        }
        return of();
      });
      mockRefs.getCurrent.mockReturnValue(of(mockRef));
      mockPeerConnection.createAnswer.mockResolvedValue(mockAnswer);

      service.call(url, mockMediaStream);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, ASYNC_OPERATION_WAIT_MS));

      expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalled();
      expect(mockPeerConnection.createAnswer).toHaveBeenCalled();
      expect(mockPeerConnection.setLocalDescription).toHaveBeenCalledWith(mockAnswer);
    });

    it('should handle incoming offer when already have local description', async () => {
      const mockOffer = { type: 'offer', sdp: 'mock-offer-sdp' } as RTCSessionDescriptionInit;
      const mockRef: Ref = {
        url: 'tag:/user/alice?plugin/user/video',
        origin: '',
        tags: ['plugin/user/video', 'plugin/user/lobby'],
        plugins: {
          'plugin/user/video': {
            offer: mockOffer,
          },
        },
      };

      // Set local description to simulate that we've already made an offer
      mockPeerConnection.localDescription = { type: 'offer', sdp: 'our-offer' };

      mockStomp.watchResponse.mockImplementation((responseUrl: string) => {
        if (responseUrl === 'tag:/user/test') {
          return of('tag:/user/alice?plugin/user/video');
        }
        if (responseUrl === 'tag:/chat') {
          return of('tag:/user/alice?plugin/user/video');
        }
        return of();
      });
      mockRefs.getCurrent.mockReturnValue(of(mockRef));

      service.call('tag:/chat', mockMediaStream);

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

      // Set up the stream so peer() can access it
      mockStore.video.stream = mockMediaStream;
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
      const mockOffer = { type: 'offer', sdp: 'mock-sdp' } as RTCSessionDescriptionInit;
      const mockRef: Ref = {
        url: 'tag:/user/alice?plugin/user/video',
        origin: '',
        tags: ['plugin/user/video', 'plugin/user/lobby'],
        plugins: {
          'plugin/user/video': {
            offer: mockOffer,
            candidate: [mockCandidate],
          },
        },
      };

      // Set remote description so ICE candidates can be added
      mockPeerConnection.remoteDescription = { type: 'offer', sdp: 'mock-sdp' };

      mockStomp.watchResponse.mockImplementation((responseUrl: string) => {
        if (responseUrl === 'tag:/user/test') {
          return of('tag:/user/alice?plugin/user/video');
        }
        if (responseUrl === 'tag:/chat') {
          return of('tag:/user/alice?plugin/user/video');
        }
        return of();
      });
      mockRefs.getCurrent.mockReturnValue(of(mockRef));

      service.call('tag:/chat', mockMediaStream);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, ASYNC_OPERATION_WAIT_MS));

      expect(mockPeerConnection.addIceCandidate).toHaveBeenCalledWith(mockCandidate);
    });

    it('should handle errors when adding ICE candidates', async () => {
      const mockCandidate = { candidate: 'mock-candidate', sdpMid: '0' } as RTCIceCandidate;
      const mockOffer = { type: 'offer', sdp: 'mock-sdp' } as RTCSessionDescriptionInit;
      const mockRef: Ref = {
        url: 'tag:/user/alice?plugin/user/video',
        origin: '',
        tags: ['plugin/user/video', 'plugin/user/lobby'],
        plugins: {
          'plugin/user/video': {
            offer: mockOffer,
            candidate: [mockCandidate],
          },
        },
      };

      // Set remote description so ICE candidates can be added
      mockPeerConnection.remoteDescription = { type: 'offer', sdp: 'mock-sdp' };

      mockStomp.watchResponse.mockImplementation((responseUrl: string) => {
        if (responseUrl === 'tag:/user/test') {
          return of('tag:/user/alice?plugin/user/video');
        }
        if (responseUrl === 'tag:/chat') {
          return of('tag:/user/alice?plugin/user/video');
        }
        return of();
      });
      mockRefs.getCurrent.mockReturnValue(of(mockRef));
      mockPeerConnection.addIceCandidate.mockRejectedValue(new Error('Invalid candidate'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      service.call('tag:/chat', mockMediaStream);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, ASYNC_OPERATION_WAIT_MS));

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error adding received ice candidate', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('cleanup on hangup', () => {
    it('should clear query and responseOf on hangup', () => {
      service.url = 'test:/chat';

      service.hangup();

      expect(service.url).toBe('');
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
        hungup: new Map<string, boolean>(),
        call: vi.fn(),
        addStream: vi.fn(),
        remove: vi.fn(),
        reset: vi.fn(),
        hangup: vi.fn(),
      };
      freshMockStore = {
        video: videoStore,
        account: { tag: 'user/test', localTag: 'user/test' },
      };

      // Replace the service's store reference
      (service as any).store = freshMockStore;

      // Reset service state
      service.url = '';
    });

    it('should stop previous subscription when calling with different parameters', () => {
      const mockRef1: Ref = {
        url: 'tag:/user/alice?plugin/user/video',
        origin: '',
        tags: ['plugin/user/video'],
      };
      const mockPage1: Page<Ref> = Page.of([mockRef1]);

      mockRefs.page.mockReturnValue(of(mockPage1));

      // Subscribe to destroy$ before making calls
      const firstDestroySpy = vi.fn();
      service['destroy$'].subscribe(firstDestroySpy);

      // First call
      service.call('tag:/chat1', mockMediaStream);

      // Second call with different URL
      service.call('tag:/chat2', mockMediaStream);

      expect(firstDestroySpy).toHaveBeenCalled();
    });

    it('should not create new subscription when calling with same parameters', () => {
      const url = 'tag:/chat';

      service.url = url;

      const pageCallCount = mockRefs.page.mock.calls.length;

      service.call(url, mockMediaStream);

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

      service.call('tag:/chat', mockMediaStream);

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

      // Set up the stream so peer() can access it
      mockStore.video.stream = mockMediaStream;
      service.peer(user);

      expect(trackHandler).toBeDefined();

      // Simulate track event
      const mockEvent = {
        streams: [mockRemoteStream],
        track: { readyState: 'live' }
      } as any;
      trackHandler!(mockEvent);

      expect(mockStore.video.addStream).toHaveBeenCalledWith(user, mockRemoteStream);
    });
  });
});
