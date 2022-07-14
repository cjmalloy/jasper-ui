import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminBackupPage } from './backup.component';

describe('BackupComponent', () => {
  let component: AdminBackupPage;
  let fixture: ComponentFixture<AdminBackupPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AdminBackupPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminBackupPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
