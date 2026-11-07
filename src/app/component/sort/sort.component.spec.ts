/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AdminService } from '../../service/admin.service';
import { SortComponent } from './sort.component';

describe('SortComponent', () => {
  let component: SortComponent;
  let fixture: ComponentFixture<SortComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SortComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SortComponent);
    component = fixture.componentInstance;
    component.sorts.set(['modified']);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should only offer the sort columns of the entity', () => {
    const admin = TestBed.inject(AdminService);
    vi.spyOn(admin, 'tagSorts').mockReturnValue(<any[]> [
      { sort: 'tag:len' }, { sort: 'name' }, { sort: 'published' as any }, { sort: 'tags:len' as any },
      { sort: 'config->version:num' }, { sort: 'external->ids:len' as any }, { sort: 'schema->x' as any },
    ]);
    vi.spyOn(admin, 'refSorts').mockReturnValue(<any[]> [{ sort: 'tags:len' }, { sort: 'published' }]);
    const offered = (type: string) => {
      const f = TestBed.createComponent(SortComponent);
      f.componentRef.setInput('type', type);
      return f.componentInstance.allSorts().map(s => s.value);
    };
    expect(offered('ref')).toEqual(['tags:len', 'published']);
    expect(offered('ext')).toEqual(['tag:len', 'name', 'config->version:num']);
    expect(offered('user')).toEqual(['tag:len', 'name', 'external->ids:len']);
    expect(offered('plugin')).toEqual(['tag:len', 'name', 'config->version:num', 'schema->x']);
    expect(offered('template')).toEqual(['tag:len', 'name', 'config->version:num', 'schema->x']);
  });

  it('should show a sort that is only in the URL with a generated label', () => {
    vi.spyOn(TestBed.inject(AdminService), 'getPlugin').mockImplementation(tag => tag === 'plugin/duration' ? <any> { tag, name: '⏱️ Duration' } : undefined);
    component.sorts.set(['tags->plugin/duration:dur,DESC', 'modified']);
    const sort = component.allSorts().find(s => s.value === 'tags->plugin/duration:dur');
    expect(sort?.label).toBe('⏱️ Duration');
    expect(component.allSorts().filter(s => s.value === 'modified').length).toBe(1);
  });
});
