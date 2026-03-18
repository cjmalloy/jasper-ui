/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { PluginService } from '../../service/api/plugin.service';

import { PluginComponent } from './plugin.component';

describe('PluginComponent', () => {
  let component: PluginComponent;
  let fixture: ComponentFixture<PluginComponent>;
  let admin: any;
  let plugins: any;
  const modified = {
    toISO: () => '2024-01-01T00:00:00Z',
    toRelative: () => 'now',
  };

  beforeEach(async () => {
    admin = {
      status: { plugins: {}, disabledPlugins: {} },
      getInstalledPlugin: vi.fn(),
      resetPlugin$: vi.fn(() => of(null)),
      getPlugin: vi.fn(),
    };
    plugins = {
      update: vi.fn(() => of(null)),
      get: vi.fn(() => of({ tag: 'plugin/test', config: { description: 'edited' } })),
      create: vi.fn(() => of(null)),
      delete: vi.fn(() => of(null)),
    };
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        PluginComponent,
      ],
      providers: [
        { provide: AdminService, useValue: admin },
        { provide: PluginService, useValue: plugins },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PluginComponent);
    component = fixture.componentInstance;
    component.plugin = { tag: 'plugin/test' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should update admin plugin status after save', () => {
    component.plugin = { tag: 'plugin/test', name: 'Plugin', config: { mod: 'Wiki' } };
    component.init();
    component.editForm.patchValue({
      tag: 'plugin/test',
      name: 'Plugin',
      config: JSON.stringify({ mod: 'Wiki', description: 'edited' }),
    });

    component.save();

    expect(plugins.update).toHaveBeenCalledWith(expect.objectContaining({
      tag: 'plugin/test',
      name: 'Plugin',
      config: { mod: 'Wiki', description: 'edited' },
    }));
    expect(admin.status.plugins['plugin/test']).toEqual({ tag: 'plugin/test', config: { description: 'edited' } });
  });

  it('should move disabled plugins into disabled status after save', () => {
    plugins.get.mockReturnValueOnce(of({ tag: 'plugin/test', config: { disabled: true, description: 'edited' } }));
    component.plugin = { tag: 'plugin/test', name: 'Plugin', config: { mod: 'Wiki' } };
    component.init();
    component.editForm.patchValue({
      tag: 'plugin/test',
      name: 'Plugin',
      config: JSON.stringify({ mod: 'Wiki', disabled: true, description: 'edited' }),
    });

    component.save();

    expect(admin.status.plugins['plugin/test']).toBeUndefined();
    expect(admin.status.disabledPlugins['plugin/test']).toEqual({
      tag: 'plugin/test',
      config: { disabled: true, description: 'edited' }
    });
  });

  it('should hide reset when the local plugin matches the installed version', () => {
    component.store.account.admin = true;
    admin.getInstalledPlugin.mockReturnValue({
      tag: 'plugin/test',
      config: { mod: 'Wiki', version: 1, description: 'same' },
    });
    fixture.componentRef.setInput('plugin', {
      tag: 'plugin/test',
      origin: component.store.account.origin,
      modified,
      config: { mod: 'Wiki', version: 1, description: 'same' },
    });

    fixture.detectChanges();

    expect(component.canReset).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('reset');
  });

  it('should confirm before resetting a changed local plugin', () => {
    component.store.account.admin = true;
    admin.getInstalledPlugin.mockReturnValue({
      tag: 'plugin/test',
      config: { mod: 'Wiki', version: 1 },
    });
    fixture.componentRef.setInput('plugin', {
      tag: 'plugin/test',
      origin: component.store.account.origin,
      modified,
      config: { mod: 'Wiki', version: 1, description: 'edited' },
    });

    fixture.detectChanges();

    const reset = [...fixture.nativeElement.querySelectorAll('.actions .fake-link')]
      .find((element: HTMLElement) => element.textContent?.trim() === 'reset') as HTMLElement;
    expect(reset).toBeTruthy();

    reset.click();
    fixture.detectChanges();

    expect(admin.resetPlugin$).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('are you sure?');

    const yes = [...fixture.nativeElement.querySelectorAll('.actions .fake-link')]
      .find((element: HTMLElement) => element.textContent?.trim() === 'yes') as HTMLElement;
    yes.click();

    expect(admin.resetPlugin$).toHaveBeenCalledTimes(1);
    expect(admin.resetPlugin$.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      tag: 'plugin/test',
      config: expect.objectContaining({ description: 'edited' }),
    }));
    expect(admin.resetPlugin$.mock.calls[0]?.[1]).toEqual(expect.any(Function));
  });

  it('should hide reset immediately and update plugin status after resetting', () => {
    const reset$ = new Subject<null>();
    component.store.account.admin = true;
    admin.resetPlugin$.mockReturnValue(reset$);
    admin.status.plugins['plugin/test'] = {
      tag: 'plugin/test',
      origin: component.store.account.origin,
      modified,
      config: { mod: 'Wiki', version: 1, description: 'edited' },
    };
    admin.getInstalledPlugin.mockReturnValue({
      tag: 'plugin/test',
      config: { mod: 'Wiki', version: 1 },
    });
    fixture.componentRef.setInput('plugin', {
      tag: 'plugin/test',
      origin: component.store.account.origin,
      modified,
      config: { mod: 'Wiki', version: 1, description: 'edited' },
    });
    fixture.detectChanges();

    const request$ = component.reset$() as any;
    request$.subscribe();

    expect(component.canReset).toBe(false);
    expect(admin.status.plugins['plugin/test']).toEqual(expect.objectContaining({
      tag: 'plugin/test',
      origin: component.store.account.origin,
      config: { mod: 'Wiki', version: 1 },
    }));

    reset$.next(null);
    reset$.complete();
  });

  it('should hide reset when the local plugin only differs by _needsUpdate flag', () => {
    component.store.account.admin = true;
    admin.getInstalledPlugin.mockReturnValue({
      tag: 'plugin/test',
      config: { mod: 'Wiki', version: 1 },
    });
    fixture.componentRef.setInput('plugin', {
      tag: 'plugin/test',
      origin: component.store.account.origin,
      modified,
      config: { mod: 'Wiki', version: 1 },
      _needsUpdate: true,
    });

    fixture.detectChanges();

    expect(component.canReset).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('reset');
  });
});
