import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackupService } from '../../service/api/backup.service';

import { BackupComponent } from './backup.component';

describe('BackupComponent', () => {
  let component: BackupComponent;
  let fixture: ComponentFixture<BackupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BackupComponent ],
      imports: [
        HttpClientTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BackupComponent);
    component = fixture.componentInstance;
    component.id = 'test';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
