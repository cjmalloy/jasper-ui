/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SelectTemplateComponent } from './select-template.component';

describe('SelectTemplateComponent', () => {
  let component: SelectTemplateComponent;
  let fixture: ComponentFixture<SelectTemplateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectTemplateComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SelectTemplateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
