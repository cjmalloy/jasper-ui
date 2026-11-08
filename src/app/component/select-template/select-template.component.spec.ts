/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';

import { SelectTemplateComponent } from './select-template.component';

describe('SelectTemplateComponent', () => {
  let component: SelectTemplateComponent;
  let fixture: ComponentFixture<SelectTemplateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectTemplateComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SelectTemplateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the tag placeholder when no template is selected', () => {
    vi.spyOn(TestBed.inject(AuthzService), 'canAddTag').mockReturnValue(true);
    const admin = TestBed.inject(AdminService);
    admin._cache.clear();
    (admin as any)._status.set({
      plugins: {},
      disabledPlugins: {},
      templates: {
        '': { tag: '', config: {} },
        'kanban': { tag: 'kanban', config: { submit: 'Kanban' } },
      },
      disabledTemplates: {},
      receipts: {},
    });
    fixture.detectChanges();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    expect(component.templates().map(t => t.tag)).toEqual(['kanban']);
    expect(select.options.length).toBe(2);
    expect(select.value).toBe('');
    expect(select.selectedOptions[0].textContent).toBe('🏷️');
  });
});
