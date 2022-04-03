import { Ref } from "../model/ref";
import { authors } from "../util/format";
import * as _ from "lodash";

export function inboxes(ref: Ref, myUserTag: string): string[] {
  return _.filter(authors(ref), tag => tag !== myUserTag).map(getInbox);
}
export function getInbox(userTag: string): string {
  if (userTag.startsWith('_')) {
    return '_plugin/inbox/' + userTag.substring(1);
  } else {
    return 'plugin/inbox/' + userTag;
  }
}
