import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RefPage } from './ref.component';

describe('RefComponent', () => {
  let component: RefPage;
  let fixture: ComponentFixture<RefPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RefPage],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
