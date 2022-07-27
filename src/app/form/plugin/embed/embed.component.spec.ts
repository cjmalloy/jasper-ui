import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
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
    component.plugins = new FormGroup({ 'plugin/embed': new FormGroup({
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
