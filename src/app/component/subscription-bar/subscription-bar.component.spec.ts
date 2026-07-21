/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { SubscriptionBarComponent } from './subscription-bar.component';

describe('SubscriptionBarComponent', () => {
  let component: SubscriptionBarComponent;
  let fixture: ComponentFixture<SubscriptionBarComponent>;
  let navigationDescriptor: PropertyDescriptor | undefined;

  beforeEach(async () => {
    navigationDescriptor = Object.getOwnPropertyDescriptor(window, 'navigation');
    await TestBed.configureTestingModule({
      imports: [SubscriptionBarComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubscriptionBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (navigationDescriptor) {
      Object.defineProperty(window, 'navigation', navigationDescriptor);
    } else {
      delete (window as any).navigation;
    }
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sets the back boundary after initial navigation', () => {
    const navigation = { currentEntry: { index: 2 } };
    Object.defineProperty(window, 'navigation', {
      configurable: true,
      value: navigation,
    });

    navigation.currentEntry.index = 3;
    const router = TestBed.inject(Router);
    (router.events as Subject<NavigationEnd>).next(new NavigationEnd(1, '/home', '/home'));

    const back = vi.spyOn(component.location, 'back');
    component.back();
    expect(back).not.toHaveBeenCalled();

    navigation.currentEntry.index = 4;
    component.back();
    expect(back).toHaveBeenCalledOnce();
  });
});
