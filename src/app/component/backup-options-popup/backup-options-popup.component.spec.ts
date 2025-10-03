import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { BackupOptions } from '../../model/backup';
import { BackupOptionsPopupComponent } from './backup-options-popup.component';

describe('BackupOptionsPopupComponent', () => {
  let component: BackupOptionsPopupComponent;
  let fixture: ComponentFixture<BackupOptionsPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BackupOptionsPopupComponent ],
      imports: [ ReactiveFormsModule ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BackupOptionsPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be hidden by default', () => {
    expect(component.visible).toBeFalsy();
  });

  it('should show popup when show() is called', () => {
    component.show();
    expect(component.visible).toBeTruthy();
  });

  it('should emit confirmed event with options when confirmed', () => {
    let emittedOptions: BackupOptions | undefined;
    component.confirmed.subscribe(options => emittedOptions = options);
    
    component.optionsForm.patchValue({
      cache: true,
      ref: true,
      ext: false,
      user: true,
      plugin: false,
      template: true,
      newerThan: '2024-01-01T00:00:00',
      olderThan: '',
    });
    
    component.confirm();
    
    expect(emittedOptions).toBeDefined();
    expect(emittedOptions!.cache).toBeTruthy();
    expect(emittedOptions!.ext).toBeFalsy();
    expect(emittedOptions!.newerThan).toBe('2024-01-01T00:00:00');
    expect(emittedOptions!.olderThan).toBeUndefined();
  });

  it('should hide popup after cancel', () => {
    component.show();
    component.cancel();
    expect(component.visible).toBeFalsy();
  });
});
