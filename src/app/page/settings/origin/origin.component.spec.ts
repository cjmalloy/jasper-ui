import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { SettingsOriginPage } from './origin.component';

describe('SettingsOriginPage', () => {
  let component: SettingsOriginPage;
  let fixture: ComponentFixture<SettingsOriginPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SettingsOriginPage],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsOriginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
