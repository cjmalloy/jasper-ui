import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';

import { QtagsFormComponent } from './qtags.component';

describe('QtagsFormComponent', () => {
  let component: QtagsFormComponent;
  let fixture: ComponentFixture<QtagsFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QtagsFormComponent ],
      imports: [
        ReactiveFormsModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QtagsFormComponent);
    component = fixture.componentInstance;
    component.group = new UntypedFormGroup({ tags: new UntypedFormControl({}) });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
