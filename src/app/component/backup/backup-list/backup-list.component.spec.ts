import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BackupListComponent } from './backup-list.component';

describe('BackupListComponent', () => {
  let component: BackupListComponent;
  let fixture: ComponentFixture<BackupListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackupListComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(BackupListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
