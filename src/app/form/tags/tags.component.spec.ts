import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { TagsFormComponent } from './tags.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('TagsFormComponent', () => {
  let component: TagsFormComponent;
  let fixture: ComponentFixture<TagsFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [TagsFormComponent],
    imports: [ReactiveFormsModule,
        RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
})
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TagsFormComponent);
    component = fixture.componentInstance;
    component.group = new UntypedFormGroup({ tags: new UntypedFormControl({}) });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
