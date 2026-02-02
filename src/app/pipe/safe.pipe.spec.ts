/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { SafePipe } from './safe.pipe';

describe('SafePipe', () => {
  it('create an instance', () => {
    TestBed.configureTestingModule({
      providers: [SafePipe],
    });
    const pipe = TestBed.inject(SafePipe);
    expect(pipe).toBeTruthy();
  });
});
