import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { TagPage } from './tag.component';

describe('TagPage', () => {
  let component: TagPage;
  let fixture: ComponentFixture<TagPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TagPage],
      imports: [
        HttpClientModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TagPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
