/// <reference types="vitest/globals" />
import { OverlayModule } from '@angular/cdk/overlay';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ForceDirectedComponent } from './force-directed.component';
import { Rect } from '../../../util/math';

describe('ForceDirectedComponent', () => {
  let component: ForceDirectedComponent;
  let fixture: ComponentFixture<ForceDirectedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        OverlayModule,
        forwardRef(() => ForceDirectedComponent),
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),]
    }).compileComponents();

    fixture = TestBed.createComponent(ForceDirectedComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('content', [{ url: '' }]);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should draw nodes when the graph store changes', () => {
    component.store.graph.nodes.set([{ url: 'https://example.com' }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.force-directed-graph circle')).toHaveLength(1);
  });

  it('isolates mutable simulation data and preserves its positions across store updates', () => {
    const first = Object.freeze({ url: 'https://example.com/first' });
    const second = Object.freeze({ url: 'https://example.com/second' });
    const link = Object.freeze({ source: first.url, target: second.url });
    component.store.graph.nodes.set([first, second]);
    component.store.graph.links.set([link]);
    component.update();
    const nodes = (component as any).simulationNodes;
    nodes[0].x = 42;
    nodes[0].y = 24;
    const links = (component as any).simulationLinks;
    expect(links[0]).not.toBe(link);
    expect(links[0].source).toBe(nodes[0]);
    expect((first as any).x).toBeUndefined();
    component.store.graph.select(first);
    component.update();
    expect((component as any).simulationNodes[0].x).toBe(42);
    expect((component as any).isSelected(nodes[0])).toBe(true);
  });

  it('selects and pins using simulation positions rather than store object identity', () => {
    component.store.graph.nodes.set([{ url: 'https://example.com/pinned' }]);
    component.update();
    const node = (component as any).simulationNodes[0];
    node.x = 42;
    node.y = 24;
    component.select({ x1: 40, x2: 44, y1: 20, y2: 28 } as Rect);
    expect(component.store.graph.selected()).toHaveLength(1);
    component.pin(node);
    expect(component.store.graph.nodes()[0]).toEqual(expect.objectContaining({
      pinned: true, fx: 42, fy: 24,
    }));
    expect(node.pinned).toBeUndefined();
  });
});
