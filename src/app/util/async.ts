import { Observable } from 'rxjs';

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Reads a File or Blob as a Data URL using FileReader and returns an Observable.
 * @param file The File or Blob to read.
 * @returns An Observable that emits the Data URL string upon successful completion.
 */
export function readFileAsDataURL(file: Blob): Observable<string> {
  return new Observable<string>((subscriber) => {
    const reader = new FileReader();
    reader.onload = () => {
      subscriber.next(reader.result as string);
      subscriber.complete();
    };
    reader.onerror = (error) => {
      subscriber.error(error);
    };
    reader.readAsDataURL(file);
    return () => {
      reader.abort();
    };
  });
}


/**
 * Reads a File or Blob as a string using FileReader and returns an Observable.
 * @param file The File or Blob to read.
 * @returns An Observable that emits the string upon successful completion.
 */
export function readFileAsString(file: Blob): Observable<string> {
  return new Observable<string>((subscriber) => {
    const reader = new FileReader();
    reader.onload = () => {
      subscriber.next(reader.result as string);
      subscriber.complete();
    };
    reader.onerror = (error) => {
      subscriber.error(error);
    };
    reader.readAsText(file);
    return () => {
      reader.abort();
    };
  });
}
