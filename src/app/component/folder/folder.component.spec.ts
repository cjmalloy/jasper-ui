import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { FolderComponent } from './folder.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('FolderComponent', () => {
  let component: FolderComponent;
  let fixture: ComponentFixture<FolderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FolderComponent],
      imports: [RouterModule.forRoot([])],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(FolderComponent);
    component = fixture.componentInstance;
    component.ext = { tag: 'folder'};
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
