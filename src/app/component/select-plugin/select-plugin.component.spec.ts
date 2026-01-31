import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SelectPluginComponent } from './select-plugin.component';

describe('SelectPluginComponent', () => {
  let component: SelectPluginComponent;
  let fixture: ComponentFixture<SelectPluginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectPluginComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectPluginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
