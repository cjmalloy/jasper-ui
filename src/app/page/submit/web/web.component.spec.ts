import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LinksFormComponent } from '../../../form/links/links.component';
import { RefFormComponent } from '../../../form/ref/ref.component';
import { TagsFormComponent } from '../../../form/tags/tags.component';

import { SubmitWebPage } from './web.component';

describe('SubmitWebPage', () => {
  let component: SubmitWebPage;
  let fixture: ComponentFixture<SubmitWebPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        SubmitWebPage,
        RefFormComponent,
        TagsFormComponent,
        LinksFormComponent,
      ],
      imports: [ReactiveFormsModule,
        RouterModule.forRoot([]),
      ],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubmitWebPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
