import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { SettingsMePage } from './me.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('SettingsMePage', () => {
  let component: SettingsMePage;
  let fixture: ComponentFixture<SettingsMePage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
    declarations: [SettingsMePage],
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    fixture = TestBed.createComponent(SettingsMePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
