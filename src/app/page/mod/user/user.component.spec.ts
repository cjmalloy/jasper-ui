import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModUserPage } from './user.component';

describe('UserComponent', () => {
  let component: ModUserPage;
  let fixture: ComponentFixture<ModUserPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModUserPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModUserPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
