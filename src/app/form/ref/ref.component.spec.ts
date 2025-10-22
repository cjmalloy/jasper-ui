import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PluginsFormComponent } from '../plugins/plugins.component';

import { RefFormComponent } from './ref.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('RefFormComponent', () => {
  let component: RefFormComponent;
  let fixture: ComponentFixture<RefFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([]),
        ReactiveFormsModule, RefFormComponent],
    providers: [
        PluginsFormComponent,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
    ]
})
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefFormComponent);
    component = fixture.componentInstance;
    component.group = new UntypedFormGroup({
      url: new UntypedFormControl(),
      published: new UntypedFormControl(),
      title: new UntypedFormControl(),
      comment: new UntypedFormControl(),
      sources: new UntypedFormControl(),
      alternateUrls: new UntypedFormControl(),
      tags: new UntypedFormControl(),
      plugins: new UntypedFormControl(),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
