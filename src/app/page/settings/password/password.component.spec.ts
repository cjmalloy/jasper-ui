import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { SettingsPasswordPage } from './password.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('SettingsPasswordPage', () => {
  let component: SettingsPasswordPage;
  let fixture: ComponentFixture<SettingsPasswordPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([]),
        ReactiveFormsModule, SettingsPasswordPage],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
})
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsPasswordPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
