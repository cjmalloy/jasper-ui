/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BackgammonComponent } from './backgammon.component';

describe('BackgammonComponent', () => {
  let component: BackgammonComponent;
  let fixture: ComponentFixture<BackgammonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackgammonComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(BackgammonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Illegal Moves', () => {
    it('should reject moving to a spot blocked by opponent', () => {
      component.reset('r 3-0\nb 2-0');
      expect(component.moves()[0] || []).not.toContain(5);
    });

    it('should reject moving opponent pieces', () => {
      component.reset('r 3-0\nb 2-0');
      expect(component.moves()[5]).toBeUndefined();
    });

    it('should reject moving when no dice are available', () => {
      component.state.update(state => ({
        ...state, redDice: [3, 2], turn: 'r', diceUsed: [3, 2], moves: [],
      }));
      expect(() => component.drop({
        item: { data: 'r' }, previousContainer: { data: 0 }, container: { data: 2 },
      } as any)).toThrow();
    });

    it('should reject moving from board when piece is on bar', () => {
      component.state.update(state => ({
        ...state, bar: [...state.bar, 'r'], redDice: [3, 2], turn: 'r', diceUsed: [], moves: [],
        spots: state.spots.map(spot => spot.index === 0 ? { ...spot, pieces: ['r'] } : spot),
      }));
      expect(component.redBar()).toEqual(['r']);
      expect(() => component.drop({
        item: { data: 'r' }, previousContainer: { data: 0 }, container: { data: 3 },
      } as any)).toThrow();
    });

    it('should reject bearing off when not all pieces are in home board', () => {
      component.state.update(state => ({
        ...state, redDice: [3, 2], turn: 'r', diceUsed: [], moves: [],
        spots: state.spots.map(spot => spot.index === 0 ? { ...spot, pieces: ['r'] } : spot),
      }));
      expect(() => component.drop({
        item: { data: 'r' }, previousContainer: { data: 18 }, container: { data: -2 },
      } as any)).toThrow();
    });

    it('should throw error when attempting illegal move via drop', () => {
      component.reset('r 3-0\nb 2-0');
      expect(() => component.drop({
        item: { data: 'r' }, previousContainer: { data: 0 }, container: { data: 10 },
      } as any)).toThrow();
    });
  });

  describe('Combined Moves with Hits', () => {
    beforeEach(() => {
      vi.spyOn(component, 'queueAnimation').mockImplementation(animation => component.state.set(animation.post));
      vi.spyOn(component, 'save').mockImplementation(() => {});
    });

    it('should allow combined move that hits opponent on intermediate spot', () => {
      component.state.update(state => ({
        ...state, redDice: [3, 2], turn: 'r', diceUsed: [], moves: [[5]],
        spots: state.spots.map(spot => ({
          ...spot, pieces: spot.index === 0 ? ['r'] : [3, 5, 12].includes(spot.index) ? ['b'] : [],
        })),
      }));
      const previous = component.state();
      component.drop({
        item: { data: 'r' }, previousContainer: { data: 0 }, container: { data: 5 },
      } as any);
      expect(component.blackBar()).toEqual(['b', 'b']);
      expect(component.spots()[5].pieces).toEqual(['r']);
      expect(previous.bar).toEqual([]);
      expect(previous.spots[0].pieces).toEqual(['r']);
    });

    it('should handle combined move hitting piece at final destination', () => {
      component.state.update(state => ({
        ...state, redDice: [3, 2], turn: 'r', diceUsed: [], moves: [[5]],
        spots: state.spots.map(spot => ({
          ...spot, pieces: spot.index === 0 ? ['r'] : [5, 12].includes(spot.index) ? ['b'] : [],
        })),
      }));
      component.drop({
        item: { data: 'r' }, previousContainer: { data: 0 }, container: { data: 5 },
      } as any);
      expect(component.blackBar()).toEqual(['b']);
      expect(component.spots()[5].pieces).toEqual(['r']);
    });

    it('should correctly process combined move that hits multiple pieces', () => {
      component.state.update(state => ({
        ...state, redDice: [2, 2], turn: 'r', diceUsed: [], moves: [[4]],
        spots: state.spots.map(spot => ({
          ...spot, pieces: spot.index === 0 ? ['r'] : [2, 4, 12].includes(spot.index) ? ['b'] : [],
        })),
      }));
      component.drop({
        item: { data: 'r' }, previousContainer: { data: 0 }, container: { data: 4 },
      } as any);
      expect(component.blackBar()).toEqual(['b', 'b']);
      expect(component.spots()[4].pieces).toEqual(['r']);
      expect(component.state().diceUsed).toEqual([2, 2]);
    });
  });

  it('updates computed board values and selection without mutating state', () => {
    component.reset('r 3-0\nb 2-0');
    const previous = component.state();
    const spots = component.spots();
    component.onClick(0);
    expect(component.spots()).not.toBe(spots);
    expect(component.spots().some(spot => spot.move)).toBe(true);
    expect(previous.spots.every(spot => !spot.move)).toBe(true);
    component.clearMoves();
    expect(component.spots().every(spot => !spot.move)).toBe(true);
    component.state.update(state => ({ ...state, bar: ['b'] }));
    expect(component.blackBar()).toEqual(['b']);
  });

  it('updates replay event labels when animations change and preserves them during seeking', () => {
    fixture.componentRef.setInput('text', 'r 6-6');
    fixture.detectChanges();
    component.precomputeReplayAnimations();
    expect(component.importantEvents()).toEqual([0]);
    expect(component.importantEventTypes().get(0)).toBe('Double 6s');
    component.replayToPosition(0);
    expect(component.importantEventTypes().get(0)).toBe('Double 6s');
    component.replayAnimations.set([]);
    expect(component.importantEvents()).toEqual([]);
    expect(() => component.replayToPosition(0)).not.toThrow();
  });

  it('derives bearing-off highlights from the selected move', () => {
    const moves: number[][] = [];
    moves[23] = [-2];
    component.state.update(state => ({ ...state, turn: 'r', moves }));
    component.start.set(23);
    expect(component.moveRedOff()).toBe(true);
    expect(component.moveBlackOff()).toBe(false);
    component.clearMoves();
    expect(component.moveRedOff()).toBe(false);
  });

  it('uses a boolean resizing host class and debounces resize completion', () => {
    vi.useFakeTimers();
    try {
      component.onResize();
      fixture.detectChanges();
      expect(component.resizing()).toBe(true);
      expect(fixture.nativeElement.classList.contains('resizing')).toBe(true);
      vi.advanceTimersByTime(500);
      component.onResize();
      vi.advanceTimersByTime(500);
      expect(component.resizing()).toBe(true);
      vi.advanceTimersByTime(500);
      fixture.detectChanges();
      expect(component.resizing()).toBe(false);
      expect(fixture.nativeElement.classList.contains('resizing')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
