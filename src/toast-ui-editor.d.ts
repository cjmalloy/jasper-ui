declare module '@toast-ui/editor' {
  export class Editor {
    constructor(options: {
      el: HTMLElement;
      height: string;
      initialEditType: string;
      initialValue: string;
      previewStyle: string;
      theme: string;
    });

    destroy(): void;
    focus(): void;
    getMarkdown(): string;
    on(event: string, handler: () => void): void;
    setMarkdown(markdown: string): void;
  }
}
