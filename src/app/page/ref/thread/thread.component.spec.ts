import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { RefThreadComponent } from './thread.component';

describe('RefThreadComponent', () => {
  let component: RefThreadComponent;
  let fixture: ComponentFixture<RefThreadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RefThreadComponent ],
      imports: [
        HttpClientTestingModule,
        RouterModule.forRoot([]),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RefThreadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
