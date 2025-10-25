/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { JasperFormlyModule } from '../../formly/formly.module';
import { LinksFormComponent } from './links.component';


describe('LinksFormComponent', () => {
  let component: LinksFormComponent;
  let fixture: ComponentFixture<LinksFormComponent>;

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
    component.group = new UntypedFormGroup({ links: new UntypedFormControl({}) });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
