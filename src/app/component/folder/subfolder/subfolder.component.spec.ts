import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubfolderComponent } from './subfolder.component';

describe('SubfolderComponent', () => {
  let component: SubfolderComponent;
  let fixture: ComponentFixture<SubfolderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SubfolderComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubfolderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
