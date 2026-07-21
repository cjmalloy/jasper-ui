import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FakeLinkDirective } from './fake-link.directive';

@Component({
  template: '<span class="fake-link" (click)="activated = activated + 1">activate</span>',
  imports: [FakeLinkDirective],
})
class TestComponent {
  activated = 0;
}

describe('FakeLinkDirective', () => {
  let fixture: ComponentFixture<TestComponent>;
  let fakeLink: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    fakeLink = fixture.nativeElement.querySelector('.fake-link');
  });

  it('adds button semantics', () => {
    expect(fakeLink.getAttribute('role')).toBe('button');
    expect(fakeLink.getAttribute('tabindex')).toBe('0');
  });

  it('activates with Enter', () => {
    fakeLink.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(fixture.componentInstance.activated).toBe(1);
  });

  it('activates with Space and prevents scrolling', () => {
    const keydown = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    fakeLink.dispatchEvent(keydown);

    expect(fixture.componentInstance.activated).toBe(0);
    expect(keydown.defaultPrevented).toBe(true);

    fakeLink.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));

    expect(fixture.componentInstance.activated).toBe(1);
  });
});
