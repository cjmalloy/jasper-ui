import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { LensComponent } from './lens.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('LensComponent', () => {
  let component: LensComponent;
  let fixture: ComponentFixture<LensComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
    declarations: [LensComponent],
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    fixture = TestBed.createComponent(LensComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
