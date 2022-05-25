import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { AdminPluginPage } from './plugin.component';

describe('AdminPluginPage', () => {
  let component: AdminPluginPage;
  let fixture: ComponentFixture<AdminPluginPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdminPluginPage],
      imports: [
        HttpClientModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminPluginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
