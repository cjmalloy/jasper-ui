import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { ChessComponent } from './chess.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { MergeRegion } from 'node-diff3';

describe('ChessComponent', () => {
  let component: ChessComponent;
  let fixture: ComponentFixture<ChessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [ChessComponent],
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
})
    .compileComponents();

    fixture = TestBed.createComponent(ChessComponent);
    component = fixture.componentInstance;
    component.ref = { url: '' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Merge Conflict Auto-Resolution', () => {
    it('should auto-resolve when both players made exactly one move each', () => {
      const conflict: MergeRegion<string>[] = [
        { ok: ['e2e4'] },
        { 
          conflict: { 
            b: ['e7e5'], 
            bIndex: 1,
            a: ['d7d5'],
            aIndex: 1,
            o: [],
            oIndex: 1
          } 
        }
      ];

      const result = (component as any).canAutoResolveMoveConflict(conflict);

      expect(result).toBe(true);
    });

    it('should not auto-resolve when one side made multiple moves', () => {
      const conflict: MergeRegion<string>[] = [
        { ok: ['e2e4'] },
        { 
          conflict: { 
            b: ['e7e5', 'g8f6'], 
            bIndex: 1,
            a: ['d7d5'],
            aIndex: 1,
            o: [],
            oIndex: 1
          } 
        }
      ];

      const result = (component as any).canAutoResolveMoveConflict(conflict);

      expect(result).toBe(false);
    });

    it('should not auto-resolve when both sides made multiple moves', () => {
      const conflict: MergeRegion<string>[] = [
        { ok: ['e2e4'] },
        { 
          conflict: { 
            b: ['e7e5', 'g8f6'], 
            bIndex: 1,
            a: ['d7d5', 'b8c6'],
            aIndex: 1,
            o: [],
            oIndex: 1
          } 
        }
      ];

      const result = (component as any).canAutoResolveMoveConflict(conflict);

      expect(result).toBe(false);
    });

    it('should not auto-resolve when one side has no moves', () => {
      const conflict: MergeRegion<string>[] = [
        { ok: ['e2e4'] },
        { 
          conflict: { 
            b: [], 
            bIndex: 1,
            a: ['d7d5'],
            aIndex: 1,
            o: [],
            oIndex: 1
          } 
        }
      ];

      const result = (component as any).canAutoResolveMoveConflict(conflict);

      expect(result).toBe(false);
    });

    it('should ignore empty lines when counting moves', () => {
      const conflict: MergeRegion<string>[] = [
        { ok: ['e2e4'] },
        { 
          conflict: { 
            b: ['e7e5', '  ', ''], 
            bIndex: 1,
            a: ['d7d5', '', '  '],
            aIndex: 1,
            o: [],
            oIndex: 1
          } 
        }
      ];

      const result = (component as any).canAutoResolveMoveConflict(conflict);

      expect(result).toBe(true);
    });

    it('should handle multiple conflict chunks correctly', () => {
      const conflict: MergeRegion<string>[] = [
        { ok: ['e2e4'] },
        { 
          conflict: { 
            b: ['e7e5'], 
            bIndex: 1,
            a: [],
            aIndex: 1,
            o: [],
            oIndex: 1
          } 
        },
        { ok: ['b1c3'] },
        { 
          conflict: { 
            b: [], 
            bIndex: 2,
            a: ['d7d5'],
            aIndex: 2,
            o: [],
            oIndex: 2
          } 
        }
      ];

      const result = (component as any).canAutoResolveMoveConflict(conflict);

      expect(result).toBe(true);
    });

    it('should correctly aggregate moves from multiple conflict regions', () => {
      const conflict: MergeRegion<string>[] = [
        { 
          conflict: { 
            b: ['e7e5'], 
            bIndex: 0,
            a: ['d7d5'],
            aIndex: 0,
            o: [],
            oIndex: 0
          } 
        },
        { 
          conflict: { 
            b: ['g8f6'], 
            bIndex: 1,
            a: [],
            aIndex: 1,
            o: [],
            oIndex: 1
          } 
        }
      ];

      const result = (component as any).canAutoResolveMoveConflict(conflict);

      expect(result).toBe(false);
    });
  });
});
