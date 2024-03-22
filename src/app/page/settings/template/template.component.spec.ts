import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { SettingsTemplatePage } from './template.component';

describe('SettingsTemplatePage', () => {
  let component: SettingsTemplatePage;
  let fixture: ComponentFixture<SettingsTemplatePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SettingsTemplatePage ],
      imports: [
        HttpClientTestingModule,
        RouterModule.forRoot([]),
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
