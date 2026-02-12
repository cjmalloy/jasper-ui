import { inject, Pipe, PipeTransform } from '@angular/core';
import { Observable } from 'rxjs';
import { EditorService, TagPreview } from '../service/editor.service';
import { Store } from '../store/store';

@Pipe({
    name: 'tagPreview',
    pure: true,
})
export class TagPreviewPipe implements PipeTransform {
  private editor = inject(EditorService);
  private store = inject(Store);


  transform(tags: string[]): Observable<TagPreview[]> {
    return this.editor.getTagsPreview(tags, this.store.account.origin);
  }

}
