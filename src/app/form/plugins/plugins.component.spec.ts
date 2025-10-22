import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormArray, UntypedFormGroup } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { PluginsFormComponent } from './plugins.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('PluginsFormComponent', () => {
  let component: PluginsFormComponent;
  let fixture: ComponentFixture<PluginsFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [
        RouterModule.forRoot([]),
        ReactiveFormsModule,
        PluginsFormComponent
    ],
    providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
    ],
}).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PluginsFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
