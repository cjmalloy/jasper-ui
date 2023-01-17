import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { AutofocusDirective } from './autofocus.directive';

describe('AutofocusDirective', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
      ]
    });
  });
  it('should create an instance', () => {
    const directive = new AutofocusDirective({} as any, TestBed.inject(Router));
    expect(directive).toBeTruthy();
  });
});
