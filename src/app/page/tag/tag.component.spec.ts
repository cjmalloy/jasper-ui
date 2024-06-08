import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { TagPage } from './tag.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('TagPage', () => {
  let component: TagPage;
  let fixture: ComponentFixture<TagPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [TagPage],
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
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
