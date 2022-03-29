export interface Page<T> {
  content: T[];
  empty: boolean;
  first: boolean;
  last: boolean;
  totalPages: number;
  totalElements: number;
  pageable: {
    offset: number;
    pageNumber: number;
    pageSize: number;
  }
}

export function mapPage<T>(contentMapper: (obj: any) => T): (obj: any) => Page<T> {
  return function(obj: any) {
    const page = obj as Page<any>;
    page.content.forEach(contentMapper);
    return page;
  }
}
