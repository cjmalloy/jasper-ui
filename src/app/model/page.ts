export interface Page<T> {
  content: T[];
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
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
      page: {
        number: 0,
        size: content.length,
        totalPages: 1,
        totalElements: content.length,
      },
    };
  }
}
