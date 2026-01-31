import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { Ref } from '../../../model/ref';

import { CommentEditComponent } from './comment-edit.component';

describe('CommentEditComponent', () => {
  let component: CommentEditComponent;
  let fixture: ComponentFixture<CommentEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommentEditComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    ,
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentEditComponent);
    component = fixture.componentInstance;
    component.ref = { url: '' };
    component.commentEdited$ = new Subject<Ref>();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should preserve existing tags when editing only comment text', () => {
    // Setup component with existing tags
    component.ref = {
      url: 'test-url',
      tags: ['tag1', 'tag2', 'existing-tag'],
      comment: 'Original comment'
    };
    // When editing only comment, editor doesn't change tags so editorTags should remain the same
    component.editorTags = ['tag1', 'tag2', 'existing-tag']; // Editor preserves existing tags

    // Spy on the save method to examine patches
    const patches: any[] = [];
    spyOn(component['refs'], 'patch').and.callFake((url: any, origin: any, modified: any, patchList: any) => {
      patches.push(...patchList);
      return { pipe: () => ({ subscribe: () => {} }) } as any;
    });

    // Simulate changing only the comment
    component.comment.setValue('Updated comment');
    component.comment.markAsDirty();

    // Call save
    component.save();

    // Verify that no tag patches were generated (since editor tags match existing tags)
    const tagPatches = patches.filter(p => p.path.startsWith('/tags/'));
    expect(tagPatches.length).toBe(0);

    // Verify that comment update patch was generated
    const commentPatches = patches.filter(p => p.op === 'add' && p.path === '/comment');
    expect(commentPatches.length).toBe(1);
    expect(commentPatches[0].value).toBe('Updated comment');
  });

  it('should add new tags when provided through editor', () => {
    // Setup component with existing tags
    component.ref = {
      url: 'test-url',
      tags: ['existing-tag'],
      comment: 'Original comment'
    };
    // Editor adds a new tag while keeping existing ones
    component.editorTags = ['existing-tag', 'new-tag']; // Editor now includes both existing and new

    // Spy on the save method to examine patches
    const patches: any[] = [];
    spyOn(component['refs'], 'patch').and.callFake((url: any, origin: any, modified: any, patchList: any) => {
      patches.push(...patchList);
      return { pipe: () => ({ subscribe: () => {} }) } as any;
    });

    // Call save
    component.save();

    // Verify that new tag add patch was generated
    const addPatches = patches.filter(p => p.op === 'add' && p.path === '/tags/-');
    expect(addPatches.length).toBe(1);
    expect(addPatches[0].value).toBe('new-tag');

    // Verify that no existing tags were removed
    const removePatches = patches.filter(p => p.op === 'remove' && p.path.startsWith('/tags/'));
    expect(removePatches.length).toBe(0);
  });

  it('should remove tags when they are removed through editor', () => {
    // Setup component with existing tags including 'public'
    component.ref = {
      url: 'test-url',
      tags: ['public', 'important', 'project'],
      comment: 'Original comment'
    };
    // Editor removes 'public' tag (like public/private toggle)
    component.editorTags = ['important', 'project']; // 'public' removed by editor

    // Spy on the save method to examine patches
    const patches: any[] = [];
    spyOn(component['refs'], 'patch').and.callFake((url: any, origin: any, modified: any, patchList: any) => {
      patches.push(...patchList);
      return { pipe: () => ({ subscribe: () => {} }) } as any;
    });

    // Call save
    component.save();

    // Verify that 'public' tag remove patch was generated
    const removePatches = patches.filter(p => p.op === 'remove' && p.path.startsWith('/tags/'));
    expect(removePatches.length).toBe(1);
    expect(removePatches[0].path).toBe('/tags/0'); // 'public' is at index 0

    // Verify that no tag additions occurred
    const addPatches = patches.filter(p => p.op === 'add' && p.path === '/tags/-');
    expect(addPatches.length).toBe(0);
  });
});
