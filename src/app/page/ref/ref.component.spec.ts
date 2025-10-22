import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, forwardRef } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { RefPage } from './ref.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('RefPage', () => {
  let component: RefPage;
  let fixture: ComponentFixture<RefPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([]), forwardRef(() => RefPage)],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
})
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
