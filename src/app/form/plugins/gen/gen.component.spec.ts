import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { GenFormComponent } from './gen.component';

describe('GenComponent', () => {
  let component: GenFormComponent;
  let fixture: ComponentFixture<GenFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [
        RouterModule.forRoot([]),
        ReactiveFormsModule,
        GenFormComponent
    ],
    providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
    ],
})
    .compileComponents();

    fixture = TestBed.createComponent(GenFormComponent);
    component = fixture.componentInstance;
    component.plugin = {
      tag: 'plugin/test',
      config: {
        form: [],
      }
    };
    component.plugins = new UntypedFormGroup({
      'plugin/test': new UntypedFormGroup({}),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
