import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { SettingsExtPage } from './ext.component';

describe('SettingsExtPage', () => {
  let component: SettingsExtPage;
  let fixture: ComponentFixture<SettingsExtPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SettingsExtPage ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsExtPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
