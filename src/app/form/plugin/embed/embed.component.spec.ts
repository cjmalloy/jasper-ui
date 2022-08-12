import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { MarkdownModule } from 'ngx-markdown';

import { EmbedFormComponent } from './embed.component';

describe('EmbedFormComponent', () => {
  let component: EmbedFormComponent;
  let fixture: ComponentFixture<EmbedFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EmbedFormComponent ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        ReactiveFormsModule,
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
