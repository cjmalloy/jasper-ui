/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { EditorService } from '../service/editor.service';
import { TagPreviewPipe } from './tag-preview.pipe';

describe('TagPreviewPipe', () => {
  it('create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: EditorService, useValue: {} },
      ],
    });
    const pipe = TestBed.runInInjectionContext(() => new TagPreviewPipe());
    expect(pipe).toBeTruthy();
  });
});
