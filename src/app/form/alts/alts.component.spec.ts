import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { AltsFormComponent } from './alts.component';

describe('AltsComponent', () => {
  let component: AltsFormComponent;
  let fixture: ComponentFixture<AltsFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AltsFormComponent ],
      imports: [
        ReactiveFormsModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AltsFormComponent);
    fixture.componentInstance.group = new FormGroup({ alternateUrls: new FormControl({}) });
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
