/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { LinksFormComponent } from '../../../form/links/links.component';
import { RefFormComponent } from '../../../form/ref/ref.component';
import { TagsFormComponent } from '../../../form/tags/tags.component';
import { JasperFormlyModule } from '../../../formly/formly.module';

import { SubmitWebPage } from './web.component';

describe('SubmitWebPage', () => {
  let component: SubmitWebPage;
  let fixture: ComponentFixture<SubmitWebPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        JasperFormlyModule,
        SubmitWebPage,
        RefFormComponent,
        TagsFormComponent,
        LinksFormComponent,
      ],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
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
