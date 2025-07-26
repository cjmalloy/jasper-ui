import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InlinePluginComponent } from './inline-plugin.component';

describe('InlinePluginComponent', () => {
  let component: InlinePluginComponent;
  let fixture: ComponentFixture<InlinePluginComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [InlinePluginComponent]
    });
    fixture = TestBed.createComponent(InlinePluginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
