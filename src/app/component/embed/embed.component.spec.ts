import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkdownModule } from 'ngx-markdown';

import { EmbedComponent } from './embed.component';

describe('EmbedComponent', () => {
  let component: EmbedComponent;
  let fixture: ComponentFixture<EmbedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EmbedComponent ],
      imports: [
        HttpClientTestingModule,
        MarkdownModule.forRoot(),
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EmbedComponent);
    component = fixture.componentInstance;
    component.ref = { url: '' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
