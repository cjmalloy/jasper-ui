import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { UserFormComponent } from './user.component';

describe('UserFormComponent', () => {
  let component: UserFormComponent;
  let fixture: ComponentFixture<UserFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UserFormComponent ],
      imports: [
        ReactiveFormsModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UserFormComponent);
    component = fixture.componentInstance;
    component.group = new FormGroup({
      tag: new FormControl(),
      name: new FormControl(),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
