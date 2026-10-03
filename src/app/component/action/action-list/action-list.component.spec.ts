/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfigService } from '../../../service/config.service';
import { ActionListComponent } from './action-list.component';

describe('ActionListComponent', () => {
  let component: ActionListComponent;
  let fixture: ComponentFixture<ActionListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionListComponent,],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ActionListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('ref', { url: 'test:1' });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('clears measured action widths on resize', () => {
    const cachedWidths = component.actionWidths();
    expect(component.actionWidths()).toBe(cachedWidths);

    component.onResize();

    expect(component.actionWidths()).not.toBe(cachedWidths);
  });

  it('remeasures hidden actions so they reappear when the container grows', () => {
    vi.spyOn(TestBed.inject(ConfigService), 'mobile', 'get').mockReturnValue(false);
    fixture.componentRef.setInput('groupedActions', {
      One: [{ event: 'one' }],
      Two: [{ event: 'two' }],
      Three: [{ event: 'three' }],
    });
    fixture.detectChanges();
    component.hiddenActions.set(2);
    fixture.detectChanges();

    const actions = fixture.nativeElement.querySelectorAll('.list-action');
    expect(actions.length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.overflow-action').length).toBe(2);
    for (const action of actions) {
      Object.defineProperty(action, 'offsetWidth', { configurable: true, value: 20 });
    }
    Object.defineProperty(fixture.nativeElement.parentElement, 'offsetWidth', {
      configurable: true, value: 200,
    });
    component.onResize();
    fixture.detectChanges();

    expect(component.hiddenActions()).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.overflow-action').length).toBe(0);
  });
});
