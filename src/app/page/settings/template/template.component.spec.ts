import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { SettingsTemplatePage } from './template.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('SettingsTemplatePage', () => {
  let component: SettingsTemplatePage;
  let fixture: ComponentFixture<SettingsTemplatePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [SettingsTemplatePage],
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
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
