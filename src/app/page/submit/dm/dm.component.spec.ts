/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { Ref } from '../../../model/ref';
import { provideJasperFormly } from '../../../formly/formly.config';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { Store } from '../../../store/store';

import { SubmitDmPage } from './dm.component';

describe('SubmitDmPage', () => {
  let component: SubmitDmPage;
  let fixture: ComponentFixture<SubmitDmPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        SubmitDmPage
      ],
      providers: [
        provideJasperFormly(),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmitDmPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps notes mode when restoring a notes draft that mentions a user', () => {
    vi.spyOn(TestBed.inject(AdminService), 'editing').mockReturnValue({ tag: 'plugin/editing' });
    vi.spyOn(TestBed.inject(Store).submit, 'url').mockReturnValue('comment:draft');
    const draftRef = new Subject<Ref | undefined>();
    vi.spyOn(TestBed.inject(RefService), 'getEditing').mockReturnValue(draftRef);
    const bookmarksSetTo = vi.spyOn(TestBed.inject(BookmarkService), 'setTo').mockImplementation(() => {});
    const draftFixture = TestBed.createComponent(SubmitDmPage);
    const draft = draftFixture.componentInstance;
    draftFixture.detectChanges();
    draftRef.next({
      url: 'comment:draft',
      origin: '',
      tags: ['plugin/editing'],
      plugins: {
        'plugin/editing': {
          title: 'Note',
          comment: 'Hi +user/alice',
          tags: ['notes', 'plugin/inbox/user/alice'],
        },
      },
    });
    draftFixture.detectChanges();

    expect(draft.title.value).toBe('Note');
    expect(draft.to.value).toBe('');
    expect(draft.notes()).toBe(true);
    expect(draft.tags.value).toContain('notes');
    expect(draft.tags.value).not.toContain('dm');
    expect(bookmarksSetTo).not.toHaveBeenCalled();
  });
});
