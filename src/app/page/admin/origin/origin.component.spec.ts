import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { AdminOriginPage } from './origin.component';

describe('AdminOriginPage', () => {
  let component: AdminOriginPage;
  let fixture: ComponentFixture<AdminOriginPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdminOriginPage],
      imports: [
        HttpClientModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminOriginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
