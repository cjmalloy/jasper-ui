import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BackupListComponent } from './backup-list.component';

describe('BackupListComponent', () => {
  let component: BackupListComponent;
  let fixture: ComponentFixture<BackupListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [BackupListComponent]
})
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BackupListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
