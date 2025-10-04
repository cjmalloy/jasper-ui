import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormArray, UntypedFormBuilder } from '@angular/forms';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterModule } from '@angular/router';

import { TagGenFormComponent } from './tag-gen.component';

describe('TagGenFormComponent', () => {
  let component: TagGenFormComponent;
  let fixture: ComponentFixture<TagGenFormComponent>;
  let fb: UntypedFormBuilder;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TagGenFormComponent],
      imports: [
        RouterModule.forRoot([]),
        ReactiveFormsModule
      ],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        UntypedFormBuilder
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TagGenFormComponent);
    component = fixture.componentInstance;
    fb = TestBed.inject(UntypedFormBuilder);
    
    component.plugin = {
      tag: '+plugin/cron',
      config: {
        tagForm: [[{
          key: 'interval',
          type: 'duration'
        }]]
      }
    };
    component.tags = fb.array(['+plugin/cron/pt15m']);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
