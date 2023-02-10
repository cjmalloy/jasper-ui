import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { SettingsRefPage } from './ref.component';

describe('SettingsRefPage', () => {
  let component: SettingsRefPage;
  let fixture: ComponentFixture<SettingsRefPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SettingsRefPage],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsRefPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
