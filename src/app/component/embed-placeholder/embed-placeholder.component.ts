import { Component, signal, viewChild, ViewContainerRef } from '@angular/core';

@Component({
  selector: 'app-embed-placeholder',
  templateUrl: 'embed-placeholder.component.html',
  styleUrl: './embed-placeholder.component.scss',
})
export class EmbedPlaceholderComponent {

  readonly content = viewChild.required('content', { read: ViewContainerRef });

  create?: (vc: ViewContainerRef) => void;
  readonly expanded = signal(false);

  expand() {
    if (this.expanded() || !this.create) return;
    this.expanded.set(true);
    this.create(this.content());
    this.create = undefined;
  }
}
