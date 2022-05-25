import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { AltsComponent } from './alts.component';

describe('AltsComponent', () => {
  let component: AltsComponent;
  let fixture: ComponentFixture<AltsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AltsComponent ],
      imports: [
        ReactiveFormsModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AltsComponent);
    fixture.componentInstance.group = new FormGroup({ alternateUrls: new FormControl({}) });
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
