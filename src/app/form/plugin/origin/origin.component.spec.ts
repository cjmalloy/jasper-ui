import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';

import { OriginFormComponent } from './origin.component';

describe('OriginFormComponent', () => {
  let component: OriginFormComponent;
  let fixture: ComponentFixture<OriginFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OriginFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OriginFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
