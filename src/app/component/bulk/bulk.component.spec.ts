import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { BulkComponent } from './bulk.component';

describe('BulkComponent', () => {
  let component: BulkComponent;
  let fixture: ComponentFixture<BulkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BulkComponent ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
