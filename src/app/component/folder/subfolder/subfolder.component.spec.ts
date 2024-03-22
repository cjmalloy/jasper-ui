import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { SubfolderComponent } from './subfolder.component';

describe('SubfolderComponent', () => {
  let component: SubfolderComponent;
  let fixture: ComponentFixture<SubfolderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SubfolderComponent ],
      imports: [
        HttpClientTestingModule,
        RouterModule.forRoot([]),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubfolderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
