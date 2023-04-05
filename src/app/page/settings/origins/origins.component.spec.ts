import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { SettingsOriginsPage } from './origins.component';

describe('OriginsComponent', () => {
  let component: SettingsOriginsPage;
  let fixture: ComponentFixture<SettingsOriginsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SettingsOriginsPage ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(SettingsOriginsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
