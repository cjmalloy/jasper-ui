import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';

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
    component.group = new FormGroup({
      origin: new FormControl(),
      name: new FormControl(),
      url: new FormControl(),
      proxy: new FormControl(),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
