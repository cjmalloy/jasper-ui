import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding } from '@angular/core';
import { Router } from '@angular/router';
import { delay } from 'lodash-es';
import { catchError, firstValueFrom, forkJoin, throwError } from 'rxjs';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { printError } from '../../util/http';
import { getModels, getZipOrTextFile } from '../../util/zip';

@Component({
  selector: 'app-upload-ref',
  templateUrl: './upload-ref.component.html',
  styleUrls: ['./upload-ref.component.scss']
})
export class UploadRefComponent {
  @HostBinding('class') css = 'form-array';

  serverError: string[] = [];

  constructor(
    private refs: RefService,
    private router: Router,
  ) { }

  readRefs(files?: FileList) {
    this.serverError = [];
    if (!files || !files.length) return;
    getZipOrTextFile(files[0]!, 'ref.json')
      .then(json => getModels<Ref>(json))
      .then(refs => firstValueFrom(forkJoin(refs.map(ref => this.uploadRef(ref)))))
      .catch(err => this.serverError = [err])
      .then(() => delay(() => this.router.navigate(['/tag', '*'], { queryParams: { sort: 'modified,DESC' } }),
        1000));
  }

  uploadRef(ref: Ref) {
    return this.refs.create(ref).pipe(
      catchError((res: HttpErrorResponse) => {
        if (res.status === 409) {
          return this.refs.update(ref);
        }
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    );
  }
}
