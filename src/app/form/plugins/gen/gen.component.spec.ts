/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { EditorComponent } from '../../editor/editor.component';
import { JasperFormlyModule } from '../../../formly/formly.module';

import { GenFormComponent } from './gen.component';

describe('GenComponent', () => {
  let component: GenFormComponent;
  let fixture: ComponentFixture<GenFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        JasperFormlyModule,
        GenFormComponent,
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

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

  it('should create an editor input', () => {
    component.plugin = {
      tag: 'plugin/test',
      config: {
        form: [{
          key: 'comment',
          type: 'editor',
        }],
      },
    };
    component.ngOnChanges({});

    fixture.detectChanges();

    const editor = fixture.debugElement.query(
      debugElement => debugElement.componentInstance instanceof EditorComponent,
    ).componentInstance as EditorComponent;
    expect(editor.control).toBe(component.group?.get('comment'));
    expect(editor.hasTags).toBe(false);
  });
});
