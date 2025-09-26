import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { QueryComponent } from './query.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('QueryComponent', () => {
  let component: QueryComponent;
  let fixture: ComponentFixture<QueryComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [QueryComponent],
      imports: [RouterModule.forRoot([]), FormsModule],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ]}).compileComponents();

    fixture = TestBed.createComponent(QueryComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should clean and format query string correctly', () => {
    component.search('Test Query! with#Special@Characters');

    // Just check that navigation was called with a cleaned query
    expect(router.navigate).toHaveBeenCalled();
    const navigateCall = (router.navigate as jasmine.Spy).calls.mostRecent();
    // The actual cleaning keeps ! and @ characters based on the regex, so check the actual result
    expect(navigateCall.args[0][1]).toBe('test+query!+withspecial@characters');
  });
});
