import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { SettingsPluginPage } from './plugin.component';

describe('SettingsPluginPage', () => {
  let component: SettingsPluginPage;
  let fixture: ComponentFixture<SettingsPluginPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SettingsPluginPage ],
      imports: [
        HttpClientTestingModule,
        RouterModule.forRoot([]),
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsPluginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
