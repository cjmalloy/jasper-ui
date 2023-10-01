import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { RefListComponent } from './ref-list.component';

describe('RefListComponent', () => {
  let component: RefListComponent;
  let fixture: ComponentFixture<RefListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RefListComponent ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
