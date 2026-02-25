/// <reference types="vitest/globals" />
import { ElementRef } from '@angular/core';
import { StoryboardDirective } from './storyboard.directive';

describe('StoryboardDirective', () => {
  const mockStyle = {
    setProperty: vi.fn(),
    removeProperty: vi.fn(),
  };
  const mockEl: ElementRef<HTMLElement> = {
    nativeElement: {
      style: mockStyle,
      classList: { toggle: vi.fn() },
    } as any,
  };
  const mockAdmin = { getPlugin: vi.fn().mockReturnValue(null) };
  const mockProxy = { getFetch: vi.fn().mockReturnValue('https://proxy/image.jpg') };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create an instance', () => {
    const directive = new StoryboardDirective(mockEl, mockAdmin as any, mockProxy as any);
    expect(directive).toBeTruthy();
  });

  it('should remove storyboard CSS properties when no plugin is registered', () => {
    const directive = new StoryboardDirective(mockEl, mockAdmin as any, mockProxy as any);
    directive.ref = { url: 'https://example.com', plugins: { 'plugin/thumbnail/storyboard': { url: 'https://img.com', cols: 4, rows: 3 } } } as any;
    directive.ngOnChanges();
    expect(mockStyle.removeProperty).toHaveBeenCalledWith('--storyboard-url');
    expect(mockStyle.removeProperty).toHaveBeenCalledWith('--storyboard-size');
  });

  it('should apply storyboard CSS properties when plugin is registered and ref has storyboard data', () => {
    mockAdmin.getPlugin.mockImplementation((tag: string) => {
      if (tag === 'plugin/thumbnail/storyboard') return { config: {} };
      return null;
    });
    const directive = new StoryboardDirective(mockEl, mockAdmin as any, mockProxy as any);
    directive.ref = {
      url: 'https://example.com',
      origin: '',
      plugins: {
        'plugin/thumbnail/storyboard': { url: 'https://img.com', cols: 4, rows: 3 },
      },
    } as any;
    directive.ngOnChanges();
    expect(mockStyle.setProperty).toHaveBeenCalledWith('--storyboard-url', expect.any(String));
    expect(mockStyle.setProperty).toHaveBeenCalledWith('--storyboard-size', '400% 300%');
  });

  it('should use editValue plugins when storyboardEditValue is set', () => {
    mockAdmin.getPlugin.mockImplementation((tag: string) => {
      if (tag === 'plugin/thumbnail/storyboard') return { config: {} };
      return null;
    });
    const directive = new StoryboardDirective(mockEl, mockAdmin as any, mockProxy as any);
    directive.ref = { url: 'https://example.com', plugins: {} } as any;
    directive.storyboardEditValue = {
      plugins: { 'plugin/thumbnail/storyboard': { url: 'https://edit-img.com', cols: 2, rows: 2 } },
    };
    directive.ngOnChanges();
    expect(mockStyle.setProperty).toHaveBeenCalledWith('--storyboard-url', expect.any(String));
    expect(mockStyle.setProperty).toHaveBeenCalledWith('--storyboard-size', '200% 200%');
  });

  it('should set storyboard-margin and storyboard-height when width and height are provided', () => {
    mockAdmin.getPlugin.mockImplementation((tag: string) => {
      if (tag === 'plugin/thumbnail/storyboard') return { config: {} };
      return null;
    });
    const directive = new StoryboardDirective(mockEl, mockAdmin as any, mockProxy as any);
    directive.ref = {
      url: 'https://example.com',
      origin: '',
      plugins: {
        'plugin/thumbnail/storyboard': { url: 'https://img.com', cols: 2, rows: 2, width: 160, height: 90 },
      },
    } as any;
    directive.ngOnChanges();
    expect(mockStyle.setProperty).toHaveBeenCalledWith('--storyboard-margin', expect.any(String));
    expect(mockStyle.setProperty).toHaveBeenCalledWith('--storyboard-height', expect.any(String));
  });

  it('should clear storyboard CSS properties when cols is negative', () => {
    mockAdmin.getPlugin.mockImplementation((tag: string) => {
      if (tag === 'plugin/thumbnail/storyboard') return { config: {} };
      return null;
    });
    const directive = new StoryboardDirective(mockEl, mockAdmin as any, mockProxy as any);
    directive.ref = {
      url: 'https://example.com',
      origin: '',
      plugins: {
        'plugin/thumbnail/storyboard': { url: 'https://img.com', cols: -4, rows: 3 },
      },
    } as any;
    directive.ngOnChanges();
    expect(mockStyle.removeProperty).toHaveBeenCalledWith('--storyboard-size');
    expect(mockStyle.removeProperty).toHaveBeenCalledWith('--storyboard-animation');
    expect(mockStyle.setProperty).not.toHaveBeenCalledWith('--storyboard-size', expect.any(String));
  });

  it('should clear storyboard CSS properties when rows is negative', () => {
    mockAdmin.getPlugin.mockImplementation((tag: string) => {
      if (tag === 'plugin/thumbnail/storyboard') return { config: {} };
      return null;
    });
    const directive = new StoryboardDirective(mockEl, mockAdmin as any, mockProxy as any);
    directive.ref = {
      url: 'https://example.com',
      origin: '',
      plugins: {
        'plugin/thumbnail/storyboard': { url: 'https://img.com', cols: 4, rows: -3 },
      },
    } as any;
    directive.ngOnChanges();
    expect(mockStyle.removeProperty).toHaveBeenCalledWith('--storyboard-size');
    expect(mockStyle.setProperty).not.toHaveBeenCalledWith('--storyboard-size', expect.any(String));
  });

  it('should coerce non-integer cols/rows to integers', () => {
    mockAdmin.getPlugin.mockImplementation((tag: string) => {
      if (tag === 'plugin/thumbnail/storyboard') return { config: {} };
      return null;
    });
    const directive = new StoryboardDirective(mockEl, mockAdmin as any, mockProxy as any);
    directive.ref = {
      url: 'https://example.com',
      origin: '',
      plugins: {
        'plugin/thumbnail/storyboard': { url: 'https://img.com', cols: 4.9, rows: 3.1 },
      },
    } as any;
    directive.ngOnChanges();
    expect(mockStyle.setProperty).toHaveBeenCalledWith('--storyboard-size', '400% 300%');
  });

  it('should clear storyboard CSS properties when totalFrames exceeds 10000', () => {
    mockAdmin.getPlugin.mockImplementation((tag: string) => {
      if (tag === 'plugin/thumbnail/storyboard') return { config: {} };
      return null;
    });
    const directive = new StoryboardDirective(mockEl, mockAdmin as any, mockProxy as any);
    directive.ref = {
      url: 'https://example.com',
      origin: '',
      plugins: {
        'plugin/thumbnail/storyboard': { url: 'https://img.com', cols: 200, rows: 200 },
      },
    } as any;
    directive.ngOnChanges();
    expect(mockStyle.removeProperty).toHaveBeenCalledWith('--storyboard-size');
    expect(mockStyle.removeProperty).toHaveBeenCalledWith('--storyboard-animation');
    expect(mockStyle.setProperty).not.toHaveBeenCalledWith('--storyboard-size', expect.any(String));
  });

  it('should set has-storyboard-default class when storyboard exists and no thumbnail data', () => {
    mockAdmin.getPlugin.mockImplementation((tag: string) => {
      if (tag === 'plugin/thumbnail/storyboard') return { config: {} };
      return null;
    });
    const directive = new StoryboardDirective(mockEl, mockAdmin as any, mockProxy as any);
    directive.ref = {
      url: 'https://example.com',
      origin: '',
      plugins: {
        'plugin/thumbnail/storyboard': { url: 'https://img.com', cols: 2, rows: 2 },
      },
    } as any;
    directive.ngOnChanges();
    expect((mockEl.nativeElement.classList as any).toggle).toHaveBeenCalledWith('has-storyboard-default', true);
  });
});
