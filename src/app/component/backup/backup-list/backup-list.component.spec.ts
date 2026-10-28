/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BackupListComponent } from './backup-list.component';

describe('BackupListComponent', () => {
  let component: BackupListComponent;
  let fixture: ComponentFixture<BackupListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackupListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BackupListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('distinguishes an unloaded list from an empty list', () => {
    expect(fixture.nativeElement.querySelector('.no-results')).toBeNull();

    fixture.componentRef.setInput('list', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.no-results')).not.toBeNull();

    fixture.componentRef.setInput('list', undefined);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.no-results')).toBeNull();
  });
});
