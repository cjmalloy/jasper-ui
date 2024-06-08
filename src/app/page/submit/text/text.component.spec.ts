import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TagsFormComponent } from '../../../form/tags/tags.component';

import { SubmitTextPage } from './text.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('SubmitTextPage', () => {
  let component: SubmitTextPage;
  let fixture: ComponentFixture<SubmitTextPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [SubmitTextPage, TagsFormComponent],
    imports: [ReactiveFormsModule,
        RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
})
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubmitTextPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
