import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';

import { CommentEditComponent } from './comment-edit.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { Ref } from '../../../model/ref';

describe('CommentEditComponent', () => {
  let component: CommentEditComponent;
  let fixture: ComponentFixture<CommentEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [CommentEditComponent],
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
})
    .compileComponents();
  });

  beforeEach(() => {
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
    component.editorTags = []; // No new tags added through editor
    
    // Spy on the save method to examine patches
    const patches: any[] = [];
    spyOn(component['refs'], 'patch').and.callFake((url, origin, modified, patchList) => {
      patches.push(...patchList);
      return { pipe: () => ({ subscribe: () => {} }) } as any;
    });
    
    // Simulate changing only the comment
    component.comment.setValue('Updated comment');
    component.comment.markAsDirty();
    
    // Call save
    component.save();
    
    // Verify that no tag removal patches were generated
    const removePatches = patches.filter(p => p.op === 'remove' && p.path.startsWith('/tags/'));
    expect(removePatches.length).toBe(0);
    
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
    component.editorTags = ['new-tag']; // New tag added through editor
    
    // Spy on the save method to examine patches
    const patches: any[] = [];
    spyOn(component['refs'], 'patch').and.callFake((url, origin, modified, patchList) => {
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
});
