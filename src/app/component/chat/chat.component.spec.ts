/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { firstValueFrom, of } from 'rxjs';
import { RefService } from '../../service/api/ref.service';

import { ChatComponent } from './chat.component';

describe('ChatComponent', () => {
  let component: ChatComponent;
  let fixture: ComponentFixture<ChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        forwardRef(() => ChatComponent),
        MarkdownModule.forRoot(),
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should upload as public when public is toggled', async () => {
    const refs = TestBed.inject(RefService);
    const create = vi.spyOn(refs, 'create').mockReturnValue(of('2024-01-01T00:00:00Z'));
    (component as any).tags = ['public'];
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const ref = await firstValueFrom(component.upload$(file, { id: '1', name: 'test.txt', progress: 0 }));
    expect(create.mock.calls[0][0].tags).toContain('public');
    expect(ref?.tags).toContain('public');
  });

  it('should upload as private when public is not toggled', async () => {
    const refs = TestBed.inject(RefService);
    const create = vi.spyOn(refs, 'create').mockReturnValue(of('2024-01-01T00:00:00Z'));
    (component as any).tags = [];
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    await firstValueFrom(component.upload$(file, { id: '1', name: 'test.txt', progress: 0 }));
    expect(create.mock.calls[0][0].tags).not.toContain('public');
  });
});
