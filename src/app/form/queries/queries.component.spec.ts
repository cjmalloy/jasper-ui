import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl, UntypedFormGroup, ReactiveFormsModule } from '@angular/forms';

import { QueriesFormComponent } from './queries.component';

describe('QueriesFormComponent', () => {
  let component: QueriesFormComponent;
  let fixture: ComponentFixture<QueriesFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QueriesFormComponent ],
      imports: [
        ReactiveFormsModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QueriesFormComponent);
    component = fixture.componentInstance;
    component.group = new UntypedFormGroup({ tags: new UntypedFormControl({}) });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
