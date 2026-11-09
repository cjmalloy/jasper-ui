/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthzService } from '../../service/authz.service';

import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        forwardRef(() => SidebarComponent),
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show one submit per plugin in a merged settings tab', () => {
    vi.spyOn(TestBed.inject(AuthzService), 'canAddTag').mockReturnValue(true);
    fixture.componentRef.setInput('tag', '+plugin/secret');
    fixture.componentRef.setInput('group', [
      { tag: '+plugin/secret', name: 'Secret', config: { submit: 'secret', genId: true, internal: true, inputTags: ['+plugin,_plugin/secret/<Name>'] } },
      { tag: '_plugin/secret', name: 'Private Secret', config: { submit: 'private secret', genId: true, internal: true, inputTags: ['_plugin,+plugin/secret/<Name>'] } },
    ]);

    const submits = component.pluginSubmits();
    expect(submits.map(s => s.label)).toEqual(['secret', 'private secret']);
    expect(submits.map(s => s.link)).toEqual(['/submit/text', '/submit/text']);
    expect(submits.map(s => (s.params as any).inputTag)).toEqual([
      ['+plugin,_plugin/secret/<Name>'],
      ['_plugin,+plugin/secret/<Name>'],
    ]);
    for (const s of submits) {
      expect(s.params.tag).not.toContain('+plugin/secret');
      expect(s.params.tag).not.toContain('_plugin/secret');
      expect(s.params.tag).toContain('internal');
      expect((s.params as any).url).toMatch(/^internal:/);
    }
    expect((submits[0].params as any).url).not.toBe((submits[1].params as any).url);
  });

  it('should submit with the Ext stencils', () => {
    vi.spyOn(TestBed.inject(AuthzService), 'canAddTag').mockReturnValue(true);
    vi.spyOn(component, 'rootConfig').mockReturnValue({ addTags: ['public', 'car'], inputTags: ['car/<Make>/<Model>'] });
    fixture.componentRef.setInput('tag', 'car');

    expect(component.submitInputTags()).toEqual(['car/<Make>/<Model>']);
    const params = component.submitTextParams() as any;
    expect(params.inputTag).toEqual(['car/<Make>/<Model>']);
    expect(params.tag).toContain('public');
    expect(params.tag).not.toContain('car');
  });

  it('should submit with the Ext hierarchical stencils', () => {
    vi.spyOn(TestBed.inject(AuthzService), 'canAddTag').mockReturnValue(true);
    vi.spyOn(component, 'rootConfig').mockReturnValue({ addTags: ['public', 'car'], hierarchicalTags: ['car/<Make>/<Model>'] });
    fixture.componentRef.setInput('tag', 'car');

    expect(component.submitInputTags()).toEqual(['car/<Make>/<Model>']);
    const params = component.submitTextParams() as any;
    expect(params.hierarchicalTag).toEqual(['car/<Make>/<Model>']);
    expect(params.inputTag).toBeUndefined();
    expect(params.tag).toContain('public');
    expect(params.tag).not.toContain('car');
  });

  it('should not split the submit button for a single plugin', () => {
    fixture.componentRef.setInput('group', [{ tag: '+plugin/secret', config: { submit: 'secret' } }]);
    expect(component.pluginSubmits()).toEqual([]);
  });
});
