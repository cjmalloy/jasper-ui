/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { PluginComponent } from './plugin.component';

describe('PluginComponent', () => {
  let component: PluginComponent;
  let fixture: ComponentFixture<PluginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        PluginComponent,
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
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

  it('should ignore an existing delete notice when deleting', () => {
    vi.spyOn(component['admin'], 'getPlugin').mockReturnValue({ tag: 'plugin/delete' });
    vi.spyOn(component['plugins'], 'delete').mockReturnValue(of(null));
    const create = vi.spyOn(component['plugins'], 'create').mockReturnValue(throwError(() => ({ status: 409 })));

    let done = false;
    component.delete$().subscribe(() => done = true);

    expect(create).toHaveBeenCalledWith({ tag: 'plugin/test/deleted', origin: undefined, config: {} });
    expect(done).toBe(true);
    expect(component.deleted).toBe(true);
    expect(component.serverError).toEqual([]);
  });
});
