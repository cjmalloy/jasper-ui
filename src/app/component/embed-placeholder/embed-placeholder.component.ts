import { ChangeDetectionStrategy, Component, ViewContainerRef, viewChild } from '@angular/core';

@Component({
  selector: 'app-embed-placeholder',
  templateUrl: 'embed-placeholder.component.html',
  styleUrl: './embed-placeholder.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class EmbedPlaceholderComponent {

  readonly content = viewChild.required('content', { read: ViewContainerRef });

  create?: (vc: ViewContainerRef) => void;
  expanded = false;

  expand() {
    if (this.expanded || !this.create) return;
    this.expanded = true;
    this.create(this.content());
    this.create = undefined;
  }
}
