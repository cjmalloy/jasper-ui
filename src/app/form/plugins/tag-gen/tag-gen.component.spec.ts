import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterModule } from '@angular/router';

import { TagGenFormComponent } from './tag-gen.component';

describe('TagGenFormComponent', () => {
  let component: TagGenFormComponent;
  let fixture: ComponentFixture<TagGenFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TagGenFormComponent],
      imports: [
        RouterModule.forRoot([]),
        ReactiveFormsModule
      ],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TagGenFormComponent);
    component = fixture.componentInstance;
    component.plugin = {
      tag: '+plugin/cron',
      config: {
        tagForm: [[{
          key: 'interval',
          type: 'duration'
        }]]
      }
    };
    component.formIndex = 0;
    component.subTag = 'pt15m';
    component.fullTag = '+plugin/cron/pt15m';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
