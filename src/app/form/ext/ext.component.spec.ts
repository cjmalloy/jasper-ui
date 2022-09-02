import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExtFormComponent } from './ext.component';

describe('ExtFormComponent', () => {
  let component: ExtFormComponent;
  let fixture: ComponentFixture<ExtFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ExtFormComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExtFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
