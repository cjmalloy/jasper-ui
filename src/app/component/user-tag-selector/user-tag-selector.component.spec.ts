import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { AuthInterceptor } from '../../http/auth.interceptor';

import { UserTagSelectorComponent } from './user-tag-selector.component';

describe('UserTagSelectorComponent', () => {
  let component: UserTagSelectorComponent;
  let fixture: ComponentFixture<UserTagSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UserTagSelectorComponent ],
      imports: [RouterModule.forRoot([])],
      providers: [
        AuthInterceptor,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserTagSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
