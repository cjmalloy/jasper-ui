import { inject, Pipe, PipeTransform } from '@angular/core';
import { Observable } from 'rxjs';
import { EditorService, TagPreview } from '../service/editor.service';

@Pipe({
    name: 'tagPreview',
    pure: true,
})
export class TagPreviewPipe implements PipeTransform {
  private editor = inject(EditorService);


  transform(tags: string[], origin: string): Observable<TagPreview[]> {
    return this.editor.getTagsPreview(tags, origin);
  }

}
