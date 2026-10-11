/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ActionService } from '../../service/action.service';

import { ChessComponent } from './chess.component';

describe('ChessComponent', () => {
  let component: ChessComponent;
  let fixture: ComponentFixture<ChessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChessComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reloads text inputs and invalidates computed history', () => {
    expect(component.history()).toBe('');
    component.moves.set(['e4']);
    fixture.componentRef.setInput('text', '1. e4');
    fixture.detectChanges();
    expect(component.history()).toBe('e4');
    expect(component.chess.get('e4')).toMatchObject({ type: 'p', color: 'w' });
    expect(component.turn()).toBe('b');
    expect(component.moves()).not.toContain('e4');
    fixture.componentRef.setInput('text', '1. d4');
    fixture.detectChanges();
    expect(component.history()).toBe('d4');
    expect(component.chess.get('d4')).toMatchObject({ type: 'p', color: 'w' });
  });

  it('replaces the watched game on identity changes but preserves same-game updates', () => {
    const firstUpdates = new Subject<string>();
    const secondUpdates = new Subject<string>();
    const actions = TestBed.inject(ActionService);
    vi.spyOn(actions, 'comment').mockImplementation(() => {});
    const append = vi.spyOn(actions, 'append')
      .mockReturnValueOnce({ updates$: firstUpdates, append$: () => of(''), reset$: () => of('') })
      .mockReturnValueOnce({ updates$: secondUpdates, append$: () => of(''), reset$: () => of('') });
    fixture.componentRef.setInput('ref', { url: 'chess:first', origin: '', comment: '1. e4' });
    fixture.detectChanges();
    expect(firstUpdates.observed).toBe(true);
    fixture.componentRef.setInput('ref', { url: 'chess:first', origin: '', comment: '1. d4' });
    fixture.detectChanges();
    expect(append).toHaveBeenCalledTimes(1);
    expect(component.history()).toBe('e4');
    fixture.componentRef.setInput('ref', { url: 'chess:first', origin: '@remote', comment: '1. d4' });
    fixture.detectChanges();
    expect(firstUpdates.observed).toBe(false);
    expect(secondUpdates.observed).toBe(true);
    expect(component.history()).toBe('d4');
    fixture.destroy();
    expect(secondUpdates.observed).toBe(false);
  });

  it('renders a captured piece using the narrowed signal value', () => {
    component.capturedPiece.set({
      square: 'e4', piece: { square: 'e4', type: 'p', color: 'b' },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.captured')?.textContent).toBe(component.drawPiece({ square: 'e4', type: 'p', color: 'b' }));
    component.capturedPiece.set(undefined);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.captured')).toBeNull();
  });

  it('resets a different game even when its starting history is identical', () => {
    const actions = TestBed.inject(ActionService);
    vi.spyOn(actions, 'comment').mockImplementation(() => {});
    vi.spyOn(actions, 'append').mockImplementation(() => ({
      updates$: new Subject<string>(), append$: () => of(''), reset$: () => of(''),
    }));
    fixture.componentRef.setInput('ref', { url: 'chess:first', comment: '1. e4' });
    fixture.detectChanges();
    component.chess.move('e5');
    component.render();
    expect(component.history()).toContain('e5');
    fixture.componentRef.setInput('ref', { url: 'chess:second', comment: '1. e4' });
    fixture.detectChanges();
    expect(component.history()).toBe('e4');
  });
});
