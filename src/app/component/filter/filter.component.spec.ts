/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AdminService } from '../../service/admin.service';
import { EditorService } from '../../service/editor.service';
import { FilterComponent } from './filter.component';

describe('FilterComponent', () => {
  let component: FilterComponent;
  let fixture: ComponentFixture<FilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('value filters', () => {
    it('replaces the value and keeps the sort column', () => {
      component.filters.set(['query/science', 'tags->plugin/duration:dur/before/pt5m']);
      component.setValue(1, 'tags->plugin/duration:dur/before/pt5m', 'pt1h');
      expect(component.filters()).toEqual(['query/science', 'tags->plugin/duration:dur/before/pt1h']);
    });

    it('edits the value of any column filter', () => {
      fixture.componentRef.setInput('type', 'ref');
      component.filters.set(['tags:len/after/3' as any]);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.value-filter')).toBeTruthy();
      component.setValue(0, 'tags:len/after/3' as any, '5');
      expect(component.filters()).toEqual(['tags:len/after/5']);
    });
  });

  describe('value filter options', () => {
    const options = () => component.allFilters().flatMap(g => g.filters).map(i => i.filter);

    it('keeps an option for each repeated bound', () => {
      component.filters.set(['tags->plugin/duration:dur/after/pt5m', 'tags->plugin/duration:dur/after/pt1m']);
      expect(options()).toContain('tags->plugin/duration:dur/after/pt5m');
      expect(options()).toContain('tags->plugin/duration:dur/after/pt1m');
    });

    it('does not duplicate an option', () => {
      component.filters.set(['tags->plugin/duration:dur/after/pt5m', 'tags->plugin/duration:dur/after/pt5m']);
      expect(options().filter(f => f === 'tags->plugin/duration:dur/after/pt5m').length).toBe(1);
    });
  });

  describe('URL only filter labels', () => {
    const label = (filter: string) => component.allFilters().flatMap(g => g.filters).find(i => i.filter === filter)?.label;

    it('names the plugin a value filter reads', () => {
      vi.spyOn(TestBed.inject(AdminService), 'getPlugin').mockImplementation(tag => tag === 'plugin/duration' ? <any> { tag, name: '⏱️ Duration' } : undefined);
      component.filters.set(['tags->plugin/duration:dur/after/pt5m']);
      expect(label('tags->plugin/duration:dur/after/pt5m')).toBe('⏱️ Duration >');
    });

    it('uses the label of a known sort for the column', () => {
      vi.spyOn(TestBed.inject(AdminService), 'refSorts').mockReturnValue(<any[]> [{ sort: 'tags:len', label: '🏷️ tags' }]);
      fixture.componentRef.setInput('type', 'ref');
      component.filters.set(['tags:len/after/3' as any]);
      expect(label('tags:len/after/3')).toBe('🏷️ tags >');
    });

    it('names the tags in a query from their Ext', () => {
      vi.spyOn(TestBed.inject(EditorService), 'getTagNames').mockReturnValue(of(new Map([['science', '🔬️ Science']])));
      component.filters.set(['query/science:!funny']);
      TestBed.tick();
      expect(label('query/science:!funny')).toBe('🔬️ Science:!funny');
    });

    it('does not name a tag after an Object property', () => {
      component.filters.set(['query/constructor']);
      TestBed.tick();
      expect(label('query/constructor')).toBe('constructor');
    });

    it('only offers column filters the page sends', () => {
      fixture.componentRef.setInput('type', 'ref');
      component.filters.set(['config->pinned:len/after/2' as any, 'tag:len/after/2' as any, 'tags->plugin/x:len/after/1' as any]);
      expect(label('config->pinned:len/after/2')).toBeUndefined();
      expect(label('tags->plugin/x:len/after/1')).toBeUndefined();
      expect(label('tag:len/after/2')).toBeDefined();
      fixture.componentRef.setInput('type', 'ext');
      component.filters.set(['tag:len/after/2' as any, 'tags:len/after/2' as any]);
      expect(label('tag:len/after/2')).toBeDefined();
      expect(label('tags:len/after/2')).toBeUndefined();
    });
  });
});
