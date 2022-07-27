import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ForceDirectedComponent } from './force-directed.component';

describe('ForceDirectedComponent', () => {
  let component: ForceDirectedComponent;
  let fixture: ComponentFixture<ForceDirectedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ForceDirectedComponent ],
      imports: [
        HttpClientTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ForceDirectedComponent);
    component = fixture.componentInstance;
    component.content = [{ url: '' }];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
