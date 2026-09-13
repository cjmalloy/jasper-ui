import { ChangeDetectionStrategy, Component, ViewChild, ViewContainerRef } from '@angular/core';

@Component({
  selector: 'app-embed-placeholder',
  styles: `:host { display: contents; }`,
  host: { class: 'embed-placeholder' },
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (!expanded) {
      <button type="button" class="embed-expand" (click)="expand()" i18n>Embed one more level</button>
    }
    <ng-container #content></ng-container>
  `,
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
