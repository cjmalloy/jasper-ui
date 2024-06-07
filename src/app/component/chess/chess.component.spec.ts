import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { ChessComponent } from './chess.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

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
});
