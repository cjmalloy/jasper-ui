import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { SettingsBackupPage } from './backup.component';

describe('SettingsBackupPage', () => {
  let component: SettingsBackupPage;
  let fixture: ComponentFixture<SettingsBackupPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SettingsBackupPage ],
      imports: [
        HttpClientTestingModule,
        RouterModule.forRoot([]),
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsBackupPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
