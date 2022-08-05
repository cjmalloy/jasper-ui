import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl, UntypedFormGroup, ReactiveFormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';

import { EmbedFormComponent } from './embed.component';

describe('EmbedFormComponent', () => {
  let component: EmbedFormComponent;
  let fixture: ComponentFixture<EmbedFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EmbedFormComponent ],
      imports: [
        ReactiveFormsModule,
        HttpClientTestingModule,
        MarkdownModule.forRoot(),
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EmbedFormComponent);
    component = fixture.componentInstance;
    component.plugins = new UntypedFormGroup({ 'plugin/embed': new UntypedFormGroup({
        url: new UntypedFormControl(),
        width: new UntypedFormControl(),
        height: new UntypedFormControl(),
      })});
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
