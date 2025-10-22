import { Pipe, PipeTransform } from '@angular/core';
import { editor } from 'monaco-editor';
import { map, Observable } from 'rxjs';
import { AdminService } from '../service/admin.service';
import { EditorService, TagPreview } from '../service/editor.service';
import { Store } from '../store/store';

@Pipe({
    name: 'tagPreview',
    pure: true,
})
export class TagPreviewPipe implements PipeTransform {

  constructor(
    private editor: EditorService,
    private store: Store,
  ) { }

  transform(tags: string[]): Observable<TagPreview[]> {
    return this.editor.getTagsPreview(tags, this.store.account.origin);
  }

}
