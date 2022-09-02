import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { MarkdownModule } from 'ngx-markdown';

import { ThumbnailFormComponent } from './thumbnail.component';

describe('ThumbnailFormComponent', () => {
  let component: ThumbnailFormComponent;
  let fixture: ComponentFixture<ThumbnailFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ThumbnailFormComponent ],
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
    fixture = TestBed.createComponent(ThumbnailFormComponent);
    component = fixture.componentInstance;
    component.plugins = new UntypedFormGroup({ 'plugin/thumbnail': new UntypedFormGroup({
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
