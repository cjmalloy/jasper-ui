import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { FormlyModule } from '@ngx-formly/core';
import { LinksFormComponent } from './links.component';


describe('LinksFormComponent', () => {
  let component: LinksFormComponent;
  let fixture: ComponentFixture<LinksFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [
        ReactiveFormsModule,
        FormlyModule.forRoot(),
        LinksFormComponent,
    ],
})
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LinksFormComponent);
    component = fixture.componentInstance;
    component.group = new UntypedFormGroup({ links: new UntypedFormControl({}) });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
