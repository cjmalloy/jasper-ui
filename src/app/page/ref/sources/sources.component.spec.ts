import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RefSourcesComponent } from './sources.component';

describe('SourcesComponent', () => {
  let component: RefSourcesComponent;
  let fixture: ComponentFixture<RefSourcesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RefSourcesComponent],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefSourcesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
