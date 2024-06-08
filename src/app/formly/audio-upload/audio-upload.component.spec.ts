import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { AudioUploadComponent } from './audio-upload.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('AudioUploadComponent', () => {
  let component: AudioUploadComponent;
  let fixture: ComponentFixture<AudioUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [AudioUploadComponent],
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
})
    .compileComponents();

    fixture = TestBed.createComponent(AudioUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
