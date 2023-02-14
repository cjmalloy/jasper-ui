import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectPluginComponent } from './select-plugin.component';

describe('SelectPluginComponent', () => {
  let component: SelectPluginComponent;
  let fixture: ComponentFixture<SelectPluginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SelectPluginComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectPluginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
