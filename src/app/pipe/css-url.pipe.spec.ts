/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { ProxyService } from '../service/api/proxy.service';
import { CssUrlPipe } from './css-url.pipe';

describe('CssUrlPipe', () => {
  it('create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ProxyService, useValue: {} },
      ],
    });
    const pipe = TestBed.runInInjectionContext(() => new CssUrlPipe());
    expect(pipe).toBeTruthy();
  });
});
