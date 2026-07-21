export function clipboardPasteValues(event: Event) {
  return event instanceof CustomEvent && Array.isArray(event.detail) ? event.detail as string[] : [];
}
