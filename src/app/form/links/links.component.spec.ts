/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { provideJasperFormly } from '../../formly/formly.config';
import { LinksFormComponent } from './links.component';


describe('LinksFormComponent', () => {
  let component: LinksFormComponent;
  let fixture: ComponentFixture<LinksFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        LinksFormComponent,
      ],
      providers: [
        provideJasperFormly(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LinksFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('group', new UntypedFormGroup({ links: new UntypedFormControl({}) }));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
