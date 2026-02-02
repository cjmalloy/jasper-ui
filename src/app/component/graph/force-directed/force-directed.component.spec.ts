import { OverlayModule } from '@angular/cdk/overlay';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ForceDirectedComponent } from './force-directed.component';

describe('ForceDirectedComponent', () => {
  let component: ForceDirectedComponent;
  let fixture: ComponentFixture<ForceDirectedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        forwardRef(() => ForceDirectedComponent),
        OverlayModule,
      ],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),]
    ,
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ForceDirectedComponent);
    component = fixture.componentInstance;
    component.content = [{ url: '' }];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
