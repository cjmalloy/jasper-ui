import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArchiveFormComponent } from './archive.component';

describe('ArchiveComponent', () => {
  let component: ArchiveFormComponent;
  let fixture: ComponentFixture<ArchiveFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ArchiveFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ArchiveFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
