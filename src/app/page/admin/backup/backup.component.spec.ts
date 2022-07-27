import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { AdminBackupPage } from './backup.component';

describe('AdminBackupPage', () => {
  let component: AdminBackupPage;
  let fixture: ComponentFixture<AdminBackupPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AdminBackupPage ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
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
