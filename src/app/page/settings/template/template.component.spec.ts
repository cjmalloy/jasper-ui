import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { SettingsTemplatePage } from './template.component';

describe('SettingsTemplatePage', () => {
  let component: SettingsTemplatePage;
  let fixture: ComponentFixture<SettingsTemplatePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SettingsTemplatePage],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsTemplatePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
