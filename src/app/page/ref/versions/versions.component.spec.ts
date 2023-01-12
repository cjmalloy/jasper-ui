import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { RefVersionsComponent } from './versions.component';

describe('RefVersionsComponent', () => {
  let component: RefVersionsComponent;
  let fixture: ComponentFixture<RefVersionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RefVersionsComponent ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefVersionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
