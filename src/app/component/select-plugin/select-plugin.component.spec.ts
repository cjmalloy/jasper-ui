/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SelectPluginComponent } from './select-plugin.component';

describe('SelectPluginComponent', () => {
  let component: SelectPluginComponent;
  let fixture: ComponentFixture<SelectPluginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectPluginComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectPluginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('updates the plugin model when not a picker', () => {
    const select = { value: 'plugin/test' } as HTMLSelectElement;
    const picked = vi.fn();
    component.picked.subscribe(picked);
    component.choose(select);
    expect(component.plugin()).toBe('plugin/test');
    expect(picked).not.toHaveBeenCalled();
  });

  it('emits picked and clears the select without touching the model as a picker', () => {
    fixture.componentRef.setInput('picker', true);
    const select = { value: 'plugin/test' } as HTMLSelectElement;
    const picked = vi.fn();
    component.picked.subscribe(picked);
    component.choose(select);
    expect(picked).toHaveBeenCalledWith('plugin/test');
    expect(component.plugin()).toBe('');
    expect(select.value).toBe('');
  });
});
