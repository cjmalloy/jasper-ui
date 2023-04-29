import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormGroup } from '@angular/forms';

import { GenFormComponent } from './gen.component';

describe('GenFormComponent', () => {
  let component: GenFormComponent;
  let fixture: ComponentFixture<GenFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GenFormComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GenFormComponent);
    component = fixture.componentInstance;
    component.plugin = {
      tag: 'plugin/test',
      config: {
        form: [],
      }
    };
    component.plugins = new UntypedFormGroup({
      'plugin/test': new UntypedFormGroup({}),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
