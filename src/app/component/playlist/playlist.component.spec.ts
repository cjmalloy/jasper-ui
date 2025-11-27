/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Ref } from '../../model/ref';

import { PlaylistComponent } from './playlist.component';

// Mock ViewerComponent to avoid circular dependency with PlaylistComponent
@Component({
  selector: 'app-viewer',
  template: '<div>Mock Viewer</div>',
  standalone: true,
})
class MockViewerComponent {
  @Input() ref?: Ref;
  @Input() commentControl?: any;
  @Input() tags?: string[];
  @Input() expand = true;
}

describe('PlaylistComponent', () => {
  let component: PlaylistComponent;
  let fixture: ComponentFixture<PlaylistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        PlaylistComponent,
      ],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    })
    .overrideComponent(PlaylistComponent, {
      set: { imports: [MockViewerComponent] }
    })
    .compileComponents();
    fixture = TestBed.createComponent(PlaylistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
