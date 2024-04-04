import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { BackgammonComponent } from './backgammon.component';

describe('BackgammonComponent', () => {
  let component: BackgammonComponent;
  let fixture: ComponentFixture<BackgammonComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [BackgammonComponent], imports: [
        HttpClientTestingModule,
        RouterModule.forRoot([]),
      ],
    });
    fixture = TestBed.createComponent(BackgammonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
