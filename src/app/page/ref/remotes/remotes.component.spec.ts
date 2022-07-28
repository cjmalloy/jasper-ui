import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { RefRemotesComponent } from './remotes.component';

describe('RemotesComponent', () => {
  let component: RefRemotesComponent;
  let fixture: ComponentFixture<RefRemotesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RefRemotesComponent ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefRemotesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
