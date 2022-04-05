export interface Problem {
  type: string;
  title: string;
  status: number;
  path: string;
  message: string;
  detail: string;
  fieldErrors: FieldError[];
}

export interface FieldError {
  field: string;
  message: string;
  objectName: string;
}
