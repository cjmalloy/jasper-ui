import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
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
        ReactiveFormsModule,
        MarkdownModule.forRoot(),
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ThumbnailFormComponent);
    component = fixture.componentInstance;
    component.plugins = new FormGroup({ 'plugin/thumbnail': new FormGroup({
        url: new FormControl(),
        width: new FormControl(),
        height: new FormControl(),
      })});
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
