import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { RefAltsComponent } from './alts.component';

describe('AltsComponent', () => {
  let component: RefAltsComponent;
  let fixture: ComponentFixture<RefAltsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RefAltsComponent ],
      imports: [
        HttpClientTestingModule,
        RouterModule.forRoot([]),
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefAltsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
