export interface Page<T> {
  content: T[];
  empty: boolean;
  first: boolean;
  last: boolean;
  number: number;
  totalPages: number;
  size: number;
  totalElements: number;
}

export function mapPage<T>(contentMapper: (obj: any) => T): (obj: any) => Page<T> {
  return function(obj: any) {
    const page = obj as Page<any>;
    for (let i = 0; i < page.content.length; i++) {
      page.content[i] = contentMapper(page.content[i]);
    }
    return page;
  };
}

export namespace Page {
  export function of<T>(content: T[]): Page<T> {
    return {
      content,
      empty: content.length === 0,
      first: true,
      last: true,
      number: 0,
      totalPages: 1,
      size: content.length,
      totalElements: content.length,
    }
  }
}
