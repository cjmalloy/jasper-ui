/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExtListComponent } from './ext-list.component';

describe('ExtListComponent', () => {
  let component: ExtListComponent;
  let fixture: ComponentFixture<ExtListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [ExtListComponent]
})
    .compileComponents();

    fixture = TestBed.createComponent(ExtListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
