import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { ExtPage } from './ext.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('CreateExtPage', () => {
  let component: ExtPage;
  let fixture: ComponentFixture<ExtPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [ExtPage],
    imports: [ReactiveFormsModule,
        RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
})
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExtPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
