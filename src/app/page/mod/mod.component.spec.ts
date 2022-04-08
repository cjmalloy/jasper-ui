import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModPage } from './mod.component';

describe('ModComponent', () => {
  let component: ModPage;
  let fixture: ComponentFixture<ModPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
