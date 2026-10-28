/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';

import { BackupComponent } from './backup.component';

describe('BackupComponent', () => {
  let component: BackupComponent;
  let fixture: ComponentFixture<BackupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackupComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BackupComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'test');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('updates derived values when inputs change', () => {
    const originalLink = component.downloadLink();
    fixture.componentRef.setInput('id', '_next');
    fixture.componentRef.setInput('origin', '@remote');
    fixture.componentRef.setInput('size', 1024);
    fixture.detectChanges();

    expect(component.inProgress()).toBe(true);
    expect(component.fileSize()).not.toBe('0 B');
    expect(component.downloadLink()).not.toBe(originalLink);
    expect(component.downloadLink()).toContain('_next.zip?origin=%40remote');
    expect(component.downloadLinkAuth()).toContain('&p=');
  });

  it('resets deleted state when the backup changes', () => {
    component.deleted.set(true);
    expect(component.deleted()).toBe(true);
    fixture.componentRef.setInput('id', 'next');
    expect(component.deleted()).toBe(false);
  });

  it('flushes caches after a successful restore', () => {
    const http = TestBed.inject(HttpTestingController);
    const flushExts = vi.spyOn(TestBed.inject(ExtService), 'flushCache');
    const clearAccount = vi.spyOn(TestBed.inject(AccountService), 'clearCache');
    const reload = vi.spyOn(TestBed.inject(AdminService), 'reload$').mockReturnValue(of(null));
    component.restoreOptionsForm.patchValue({ plugin: true });

    component.confirmRestore();
    expect(flushExts).not.toHaveBeenCalled();
    http.expectOne(req => req.url.endsWith('/backup/restore/test')).flush('');

    expect(flushExts).toHaveBeenCalled();
    expect(clearAccount).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  it('does not flush caches when restore fails', () => {
    const http = TestBed.inject(HttpTestingController);
    const flushExts = vi.spyOn(TestBed.inject(ExtService), 'flushCache');
    const reload = vi.spyOn(TestBed.inject(AdminService), 'reload$').mockReturnValue(of(null));

    component.confirmRestore();
    http.expectOne(req => req.url.endsWith('/backup/restore/test'))
      .flush('error', { status: 500, statusText: 'Server Error' });

    expect(flushExts).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(component.serverError().length).toBeGreaterThan(0);
  });
});
