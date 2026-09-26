import { ChangeDetectionStrategy, Component, ViewChild, ViewContainerRef } from '@angular/core';

@Component({
  selector: 'app-embed-placeholder',
  templateUrl: 'embed-placeholder.component.html',
  styleUrl: './embed-placeholder.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class EmbedPlaceholderComponent {

  @ViewChild('content', { read: ViewContainerRef, static: true })
  content!: ViewContainerRef;

  create?: (vc: ViewContainerRef) => void;
  expanded = false;

  expand() {
    if (this.expanded || !this.create) return;
    this.expanded = true;
    this.create(this.content);
    this.create = undefined;
  }
}
