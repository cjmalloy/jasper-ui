import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { RefSourcesComponent } from './sources.component';

describe('RefSourcesComponent', () => {
  let component: RefSourcesComponent;
  let fixture: ComponentFixture<RefSourcesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RefSourcesComponent],
      imports: [
        HttpClientModule,
        RouterTestingModule,
      ],
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
