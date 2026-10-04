/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { EditorComponent } from '../../editor/editor.component';
import { provideJasperFormly } from '../../../formly/formly.config';

import { GenFormComponent } from './gen.component';

describe('GenComponent', () => {
  let component: GenFormComponent;
  let fixture: ComponentFixture<GenFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        GenFormComponent,
      ],
      providers: [
        provideJasperFormly(),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GenFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('plugin', {
      tag: 'plugin/test',
      config: {
        form: [],
      }
    });
    fixture.componentRef.setInput('plugins', new UntypedFormGroup({
      'plugin/test': new UntypedFormGroup({}),
    }));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should create an editor input', () => {
    fixture.componentRef.setInput('plugin', {
      tag: 'plugin/test',
      config: {
        form: [{
          key: 'comment',
          type: 'editor',
        }],
      },
    });

    fixture.detectChanges();

    const editorElement = fixture.debugElement.query(
      debugElement => debugElement.componentInstance instanceof EditorComponent,
    );
    expect(editorElement).toBeTruthy();
    const editor = editorElement.componentInstance as EditorComponent;
    expect(editor.control()).toBe(component.group()?.get('comment'));
    expect(editor.hasTags()).toBe(false);
    expect(editor.addCommentTitle()).toBe('Add comment');
    expect(editor.addCommentLabel()).toBe('+ Add comment');
    expect(editor.fillWidth()).toBe(
      fixture.nativeElement.querySelector('.editor-field .fill-editor'),
    );
  });

  it('keeps Formly schemas stable when controls emit new values', () => {
    fixture.componentRef.setInput('plugin', {
      tag: 'plugin/test',
      config: {
        form: [{ key: 'comment', type: 'editor' }],
        advancedForm: [{ key: 'extra', type: 'input' }],
      },
    });
    fixture.detectChanges();
    const form = component.form();
    const advancedForm = component.advancedForm();
    const comment = component.group()!.get('comment');

    component.group()!.patchValue({ comment: 'Updated comment', extra: 'Updated extra' });
    fixture.detectChanges();

    expect(component.form()).toBe(form);
    expect(component.advancedForm()).toBe(advancedForm);
    expect(component.group()!.get('comment')).toBe(comment);
    expect(comment!.value).toBe('Updated comment');
  });

  it('refreshes group and child selectors when parent controls change', () => {
    const replacement = new UntypedFormGroup({ comment: new UntypedFormControl('replacement') });
    expect(component.group()).not.toBe(replacement);
    component.plugins().setControl('plugin/test', replacement);
    expect(component.group()).toBe(replacement);

    fixture.componentRef.setInput('children', [
      { tag: 'plugin/first' }, { tag: 'plugin/second' },
    ]);
    expect(component.childrenOn()).toBe(0);
    component.plugins().addControl('plugin/second', new UntypedFormGroup({}));
    expect(component.childrenOn()).toBe(1);
    component.plugins().removeControl('plugin/second');
    expect(component.childrenOn()).toBe(0);
  });
});
