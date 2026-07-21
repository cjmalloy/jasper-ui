/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PluginListComponent } from './plugin-list.component';

describe('PluginListComponent', () => {
  let component: PluginListComponent;
  let fixture: ComponentFixture<PluginListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PluginListComponent],
      providers: [
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PluginListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
