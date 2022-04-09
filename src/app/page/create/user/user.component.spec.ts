import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateUserPage } from './user.component';

describe('UserComponent', () => {
  let component: CreateUserPage;
  let fixture: ComponentFixture<CreateUserPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CreateUserPage],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CreateUserPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
