/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfigService } from '../../service/config.service';

import { NavComponent } from './nav.component';

describe('NavComponent', () => {
  let component: NavComponent;
  let fixture: ComponentFixture<NavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ConfigService,
          useValue: {
            get base() { return { href: 'http://localhost' }; }
          }
        }
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('recomputes the local route when a rendered link is reused', () => {
    fixture.componentRef.setInput('url', 'tag:/first');
    expect(component.nav()).toEqual(['/tag', 'first']);
    fixture.componentRef.setInput('url', 'tag:/second');
    expect(component.nav()).toEqual(['/tag', 'second']);
  });

  it('should not treat plain hashtag as custom text', () => {
    fixture.componentRef.setInput('url', '/tag/notes');
    fixture.componentRef.setInput('text', '#notes');
    expect(component.hasText()).toBe(false);
  });

  it('should not treat hashtag with bookmark params as custom text', () => {
    fixture.componentRef.setInput('url', '/tag/notes?filter=query/+user/chris&sort=created');
    fixture.componentRef.setInput('text', '#notes');
    expect(component.nav()).toEqual(['/tag', 'notes']);
    expect(component.hasText()).toBe(false);
  });

  it('should keep custom link text for tag urls with bookmark params', () => {
    fixture.componentRef.setInput('url', '/tag/notes?filter=query/+user/chris');
    fixture.componentRef.setInput('text', 'My Notes');
    expect(component.hasText()).toBe(true);
  });
});
