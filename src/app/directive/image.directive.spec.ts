import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfigService } from '../service/config.service';
import { ImageService } from '../service/image.service';
import { EventBus } from '../store/bus';
import { Store } from '../store/store';
import { ImageDirective } from './image.directive';

describe('ImageDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: {} },
        { provide: Store, useValue: { eventBus: new EventBus() } },
        { provide: ElementRef, useValue: { nativeElement: { style: {} } } },
        { provide: ImageService, useValue: {} },
      ],
    });
    const directive = TestBed.runInInjectionContext(() => new ImageDirective());
    expect(directive).toBeTruthy();
  });

  it('should keep the image ratio when it shrinks to fit its parent', async () => {
    const parent = document.createElement('div');
    Object.defineProperty(parent, 'offsetWidth', { value: 508 });
    const el = document.createElement('div');
    parent.appendChild(el);
    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: { mobile: () => false } },
        { provide: Store, useValue: { eventBus: new EventBus() } },
        { provide: ElementRef, useValue: { nativeElement: el } },
        { provide: ImageService, useValue: { getImage: () => Promise.resolve({ width: 1000, height: 500 }) } },
      ],
    });
    const directive = TestBed.runInInjectionContext(() => new ImageDirective());
    (directive as any).loadUrl('cache:image');
    await Promise.resolve();
    expect(el.style.width).toBe('500px');
    expect(el.style.height).toBe('250px');
    expect(el.style.aspectRatio).toBe('500 / 250');
    expect(el.style.getPropertyValue('--image-ratio')).toBe('2');
  });
});
