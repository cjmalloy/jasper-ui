import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LinksFormComponent } from './links.component';


describe('LinksFormComponent', () => {
  let component: LinksFormComponent;
  let fixture: ComponentFixture<LinksFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LinksFormComponent ],
      imports: [
        ReactiveFormsModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LinksFormComponent);
    component = fixture.componentInstance;
    component.group = new FormGroup({ links: new FormControl({}) });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
