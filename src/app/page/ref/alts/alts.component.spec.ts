/// <reference types="vitest/globals" />
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { RefAltsComponent } from './alts.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('AltsComponent', () => {
  let component: RefAltsComponent;
  let fixture: ComponentFixture<RefAltsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([]), forwardRef(() => RefAltsComponent)],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
})
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefAltsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
