import { Ref } from "../model/ref";
import * as _ from "lodash";

export function primaryAuthor(ref: Ref) {
  return _.find(ref.tags, t => t.startsWith('user/'));
}
