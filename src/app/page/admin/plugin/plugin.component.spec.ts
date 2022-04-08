import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminPluginPage } from './plugin.component';

describe('PluginComponent', () => {
  let component: AdminPluginPage;
  let fixture: ComponentFixture<AdminPluginPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AdminPluginPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminPluginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
