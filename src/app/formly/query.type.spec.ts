/// <reference types="vitest/globals" />
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ExtService } from '../service/api/ext.service';
import { FormlyFieldBookmarkInput } from './bookmark.type';
import { FormlyFieldQueryInput } from './query.type';

for (const type of [FormlyFieldQueryInput, FormlyFieldBookmarkInput]) {
  describe(type.name + ' breadcrumbs', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [type],
        providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      });
    });

    it('resolves synchronous names after publishing the initial crumbs', () => {
      const fixture = TestBed.createComponent<FormlyFieldQueryInput | FormlyFieldBookmarkInput>(type);
      const component = fixture.componentInstance;
      vi.spyOn(TestBed.inject(ExtService), 'getCachedExt').mockReturnValue(of({
        tag: 'science', origin: '', name: 'Science', modifiedString: '1',
      } as any));
      component.setQuery('science');
      expect(component.breadcrumbs()[0].text).toBe('Science');
      fixture.destroy();
    });

    it('updates delayed names immutably and cancels obsolete previews', () => {
      const fixture = TestBed.createComponent<FormlyFieldQueryInput | FormlyFieldBookmarkInput>(type);
      const component = fixture.componentInstance;
      const response = new Subject<any>();
      vi.spyOn(TestBed.inject(ExtService), 'getCachedExt').mockReturnValue(response);
      component.setQuery('science');
      const previous = component.breadcrumbs()[0];
      Object.freeze(previous);
      response.next({ tag: 'science', origin: '', name: 'Science', modifiedString: '1' });
      expect(previous.text).toBe('science');
      expect(component.breadcrumbs()[0].text).toBe('Science');
      response.next({ tag: 'science', origin: '', name: 'Updated science', modifiedString: '2' });
      expect(component.breadcrumbs()[0].text).toBe('Updated science');
      component.setQuery('');
      expect(response.observed).toBe(false);
      response.next({ tag: 'science', name: 'Obsolete', modifiedString: '3' });
      expect(component.breadcrumbs()).toEqual([]);
      fixture.destroy();
    });
  });
}
