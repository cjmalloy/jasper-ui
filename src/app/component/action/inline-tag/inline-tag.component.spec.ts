/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { InlineTagComponent } from './inline-tag.component';

describe('InlineTagComponent', () => {
  let component: InlineTagComponent;
  let fixture: ComponentFixture<InlineTagComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([]), InlineTagComponent],
    providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
    ]
});
    fixture = TestBed.createComponent(InlineTagComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
