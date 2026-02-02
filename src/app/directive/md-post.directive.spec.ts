/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { MdPostDirective } from './md-post.directive';

@Component({
  template: '<div [appMdPost]="\'\'"></div>',
  imports: [MdPostDirective],
})
class TestComponent {}

describe('MdPostDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      imports: [TestComponent, MarkdownModule.forRoot()],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    const directiveEl = fixture.debugElement.children[0];
    const directive = directiveEl.injector.get(MdPostDirective);
    expect(directive).toBeTruthy();
  });
});
