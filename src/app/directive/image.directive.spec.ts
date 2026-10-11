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
});
