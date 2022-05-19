import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmbedFormComponent } from './embed.component';

describe('EmbedComponent', () => {
  let component: EmbedFormComponent;
  let fixture: ComponentFixture<EmbedFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EmbedFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EmbedFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
