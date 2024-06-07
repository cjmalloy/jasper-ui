import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { of } from 'rxjs';
import { AdminService } from '../../../service/admin.service';

import { SettingsSetupPage } from './setup.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('SettingsSetupPage', () => {
  let component: SettingsSetupPage;
  let fixture: ComponentFixture<SettingsSetupPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [SettingsSetupPage],
    imports: [RouterModule.forRoot([]),
        ReactiveFormsModule],
    providers: [
        { provide: AdminService, useValue: {
                init$: of(null),
                getPlugin() { },
                getTemplate() { },
                def: { plugins: {}, templates: {} },
                status: { plugins: {}, templates: {} }
            } },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
    ]
})
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsSetupPage);
    component = fixture.componentInstance;
    component.adminForm = new UntypedFormGroup({
      mods: new UntypedFormGroup({
        root: new UntypedFormControl(),
      }),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
