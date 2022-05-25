import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { QtagsComponent } from './qtags.component';

describe('QtagsComponent', () => {
  let component: QtagsComponent;
  let fixture: ComponentFixture<QtagsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QtagsComponent ],
      imports: [
        ReactiveFormsModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QtagsComponent);
    fixture.componentInstance.group = new FormGroup({ tags: new FormControl({}) });
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
