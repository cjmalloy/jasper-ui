export interface Resource {
  url?: string;
  mimeType: string | null;
  data: ArrayBuffer | null;
}
