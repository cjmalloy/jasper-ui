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

    // Event handler for successful file reading
    reader.onload = () => {
      subscriber.next(reader.result as string); // Emit the result
      subscriber.complete(); // Complete the observable
    };

    // Event handler for errors during file reading
    reader.onerror = (error) => {
      subscriber.error(error); // Emit the error
    };

    // Start reading the file
    reader.readAsDataURL(file);

    // Teardown logic (optional): abort the read operation if the subscriber unsubscribes early
    return () => {
      reader.abort();
    };
  });
}
