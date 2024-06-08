import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { BackgammonComponent } from './backgammon.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('BackgammonComponent', () => {
  let component: BackgammonComponent;
  let fixture: ComponentFixture<BackgammonComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
    declarations: [BackgammonComponent],
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    fixture = TestBed.createComponent(BackgammonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
