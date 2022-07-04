import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { QtagsFormComponent } from './qtags.component';

describe('QtagsComponent', () => {
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
    fixture.componentInstance.group = new FormGroup({ tags: new FormControl({}) });
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
