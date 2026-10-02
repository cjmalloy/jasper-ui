/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { EditorService, TagPreview } from '../../../service/editor.service';

import { KanbanCardComponent } from './kanban-card.component';

describe('KanbanCardComponent', () => {
  let component: KanbanCardComponent;
  let fixture: ComponentFixture<KanbanCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => KanbanCardComponent)],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(KanbanCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('ref', {url: ''});
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('updates derived badges for input and local ref changes', () => {
    fixture.componentRef.setInput('ext', { tag: 'kanban', config: { badges: ['doing', 'alice'], swimLanes: ['alice'] } });
    fixture.componentRef.setInput('ref', { url: 'comment:card', tags: ['doing', 'alice'] });
    fixture.componentRef.setInput('hideSwimLanes', false);
    fixture.detectChanges();
    expect(component.badges()).toEqual(['doing']);
    component.ref.update(ref => ({ ...ref, tags: ['alice'] }));
    expect(component.badges()).toEqual([]);
    fixture.componentRef.setInput('hideSwimLanes', true);
    fixture.detectChanges();
    expect(component.badges()).toEqual(['alice']);
  });

  it('cancels stale badge previews when the ref changes', async () => {
    const first = new Subject<TagPreview[]>();
    const second = new Subject<TagPreview[]>();
    vi.spyOn(TestBed.inject(EditorService), 'getTagsPreview').mockImplementation(tags =>
      tags.length === 1 ? tags[0] === 'doing' ? first : second : of([]));
    fixture.componentRef.setInput('ext', { tag: 'kanban', config: { badges: ['doing', 'done'] } });
    fixture.componentRef.setInput('ref', { url: 'comment:card', tags: ['doing'] });
    fixture.detectChanges();
    await vi.waitFor(() => expect(first.observed).toBe(true));
    fixture.componentRef.setInput('ref', { url: 'comment:card', tags: ['done'] });
    fixture.detectChanges();
    await vi.waitFor(() => {
      expect(first.observed).toBe(false);
      expect(second.observed).toBe(true);
    });
    second.next([{ tag: 'done', name: 'Done' }]);
    await fixture.whenStable();
    expect(component.badgeExts.value()).toEqual([{ tag: 'done', name: 'Done' }]);
    fixture.destroy();
    expect(second.observed).toBe(false);
  });
});
