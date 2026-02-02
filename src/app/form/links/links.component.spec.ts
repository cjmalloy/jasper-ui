import { NO_ERRORS_SCHEMA } from '@angular/core';
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
        LinksFormComponent,
        ReactiveFormsModule,
        JasperFormlyModule,
      ],
      providers: [
        provideRouter([]),
      ],
      schemas: [NO_ERRORS_SCHEMA],
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
