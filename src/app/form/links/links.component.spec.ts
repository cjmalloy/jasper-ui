/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule, UntypedFormArray, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { JasperFormlyModule } from '../../formly/formly.module';
import { LinksFormComponent } from './links.component';


describe('LinksFormComponent', () => {
  let component: LinksFormComponent;
  let fixture: ComponentFixture<LinksFormComponent>;
  let fb: FormBuilder;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        JasperFormlyModule,
        LinksFormComponent,
      ],
      providers: [
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LinksFormComponent);
    component = fixture.componentInstance;
    fb = TestBed.inject(FormBuilder);
    component.group = new UntypedFormGroup({ links: fb.array([]) });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('setLinks clones the incoming array instead of sharing its reference', () => {
    const links = ['https://source.example'];

    component.setLinks(links);
    links.push('https://mutated.example');

    expect(component.model).toEqual(['https://source.example']);
    expect((component.links as UntypedFormArray).value).toEqual(['https://source.example']);
  });

  it('addLink rebuilds from the current form array value', () => {
    component.setLinks(['https://source.example', 'https://second.example']);
    component.addLink('');

    expect(component.model).toEqual([
      'https://source.example',
      'https://second.example',
      '',
    ]);
    expect((component.links as UntypedFormArray).value).toEqual(component.model);
  });
});
