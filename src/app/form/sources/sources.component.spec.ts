import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { SourcesFormComponent } from './sources.component';

describe('SourcesComponent', () => {
  let component: SourcesFormComponent;
  let fixture: ComponentFixture<SourcesFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SourcesFormComponent ],
      imports: [
        ReactiveFormsModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SourcesFormComponent);
    fixture.componentInstance.group = new FormGroup({ sources: new FormControl({}) });
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
