import { Ref } from '../../model/ref';

export interface KanbanDrag {
  from: string;
  to: string;
  ref: Ref;
  index: number;
}
