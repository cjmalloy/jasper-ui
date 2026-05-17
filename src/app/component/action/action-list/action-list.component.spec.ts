/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Action } from '../../../model/tag';
import { ActionService } from '../../../service/action.service';
import { ConfigService } from '../../../service/config.service';
import { ActionListComponent } from './action-list.component';

describe('ActionListComponent', () => {
  let component: ActionListComponent;
  let fixture: ComponentFixture<ActionListComponent>;
  let acts: { apply$: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    acts = {
      apply$: vi.fn(() => of(null)),
    };
    await TestBed.configureTestingModule({
      imports: [ActionListComponent,],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActionService, useValue: acts },
        { provide: ConfigService, useValue: { mobile: false } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ActionListComponent);
    component = fixture.componentInstance;
    component.ref = { url: 'https://example.com/test.pdf', origin: '', tags: [] } as any;
    localStorage.clear();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('applies all grouped actions by default', () => {
    const actions = [
      { label: 'markdown', event: 'markitdown' },
      { label: 'markdown', event: 'marker' },
    ] as Action[];
    const showMultiActions = vi.spyOn(component, 'showMultiActions');

    component.triggerActions(new MouseEvent('click'), 'markdown', actions);

    expect(showMultiActions).not.toHaveBeenCalled();
    expect(acts.apply$).toHaveBeenCalledWith(actions, component.ref, undefined);
  });

  it('opens a chooser for grouped multi actions without a remembered selection', () => {
    const actions = [
      { label: 'markdown', event: 'markitdown', multi: true, _parent: { tag: 'plugin/delta/md', config: { mod: 'MarkItDown' } } as any },
      { label: 'markdown', event: 'marker', multi: true, _parent: { tag: 'plugin/delta/md/marker', config: { mod: 'Marker PDF' } } as any },
    ] as Action[];
    const showMultiActions = vi.spyOn(component, 'showMultiActions').mockImplementation(() => undefined);

    component.triggerActions(new MouseEvent('click'), 'markdown', actions);

    expect(showMultiActions).toHaveBeenCalledWith(expect.any(MouseEvent), 'markdown', actions);
    expect(acts.apply$).not.toHaveBeenCalled();
  });

  it('uses the remembered multi action selection', () => {
    const actions = [
      { label: 'markdown', event: 'markitdown', multi: true, _parent: { tag: 'plugin/delta/md', config: { mod: 'MarkItDown' } } as any },
      { label: 'markdown', event: 'marker', multi: true, _parent: { tag: 'plugin/delta/md/marker', config: { mod: 'Marker PDF' } } as any },
    ] as Action[];
    const key = (component as any).multiActionStorageKey('markdown', actions);
    const remembered = (component as any).multiActionId(actions[1]);
    localStorage.setItem(key, remembered);

    component.triggerActions(new MouseEvent('click'), 'markdown', actions);

    expect(acts.apply$).toHaveBeenCalledWith(actions[1], component.ref, undefined);
  });
});
