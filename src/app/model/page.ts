export interface Page<T> {
  content: T[];
  empty: boolean;
  first: boolean;
  last: boolean;
  number: number;
  totalPages: number;
  size: number;
  totalElements: number;
  numberOfElements: number;
}

export function mapPage<T>(contentMapper: (obj: any) => T): (obj: any) => Page<T> {
  return function(obj: any) {
    const page = obj as Page<any>;
    page.content.forEach(contentMapper);
    return page;
  }
}
