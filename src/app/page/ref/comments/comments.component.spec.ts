import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { RefCommentsComponent } from './comments.component';

describe('RefCommentsComponent', () => {
  let component: RefCommentsComponent;
  let fixture: ComponentFixture<RefCommentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RefCommentsComponent],
      imports: [
        HttpClientModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefCommentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
