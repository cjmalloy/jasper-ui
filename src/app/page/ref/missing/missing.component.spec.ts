import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { RefMissingComponent } from './missing.component';

describe('RefMissingComponent', () => {
  let component: RefMissingComponent;
  let fixture: ComponentFixture<RefMissingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RefMissingComponent ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefMissingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
