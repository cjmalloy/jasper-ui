import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateProfilePage } from './profile.component';

describe('ProfileComponent', () => {
  let component: CreateProfilePage;
  let fixture: ComponentFixture<CreateProfilePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CreateProfilePage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CreateProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
