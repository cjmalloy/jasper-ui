import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PluginFormComponent } from './plugin.component';

describe('PluginFormComponent', () => {
  let component: PluginFormComponent;
  let fixture: ComponentFixture<PluginFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PluginFormComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PluginFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
