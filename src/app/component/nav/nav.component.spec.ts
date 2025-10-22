import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { ConfigService } from '../../service/config.service';

import { NavComponent } from './nav.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('NavComponent', () => {
  let component: NavComponent;
  let fixture: ComponentFixture<NavComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([]), NavComponent],
    providers: [
      provideHttpClient(withInterceptorsFromDi()), 
      provideHttpClientTesting(),
      {
        provide: ConfigService,
        useValue: {
          get base() { return { href: 'http://localhost' }; }
        }
      }
    ]
});
    fixture = TestBed.createComponent(NavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
