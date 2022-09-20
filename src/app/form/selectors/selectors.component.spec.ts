import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';

import { SelectorsFormComponent } from './selectors.component';

describe('SelectorsFormComponent', () => {
  let component: SelectorsFormComponent;
  let fixture: ComponentFixture<SelectorsFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SelectorsFormComponent ],
      imports: [
        ReactiveFormsModule,
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectorsFormComponent);
    component = fixture.componentInstance;
    component.group = new UntypedFormGroup({ tags: new UntypedFormControl({}) });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
