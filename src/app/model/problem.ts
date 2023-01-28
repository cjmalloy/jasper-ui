export interface Problem {
  type: string;
  title: string;
  status: number;
  path: string;
  message: string;
  detail?: string;
  fieldErrors?: FieldError[];
  violations?: FieldError[];
}

export interface Violation {
  field: string;
  message: string;
}

export interface FieldError extends Violation {
  objectName: string;
}
