import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModExtPage } from './ext.component';

describe('ExtComponent', () => {
  let component: ModExtPage;
  let fixture: ComponentFixture<ModExtPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModExtPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModExtPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
