import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExtComponent } from './ext.component';

describe('ExtComponent', () => {
  let component: ExtComponent;
  let fixture: ComponentFixture<ExtComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ExtComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExtComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
