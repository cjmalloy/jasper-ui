/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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

  it('renders plugin actions inline', () => {
    fixture.componentRef.setInput('groupedActions', {
      One: [{ event: 'one' }],
      Two: [{ event: 'two' }],
      Three: [{ event: 'three' }],
    });
    fixture.detectChanges();
    const actions = fixture.nativeElement.querySelectorAll('.list-action');
    expect(actions.length).toBe(3);
  });
});
