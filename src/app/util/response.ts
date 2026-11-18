import { catchError, EMPTY, filter, mergeMap, Observable, tap } from 'rxjs';
import { Ref } from '../model/ref';
import { AdminService } from '../service/admin.service';
import { RefService } from '../service/api/ref.service';
import { StompService } from '../service/api/stomp.service';
import { TaggingService } from '../service/api/tagging.service';

export function markRead(admin: AdminService, ts: TaggingService, ref: Ref): Ref {
  if (!admin.getPlugin('plugin/user/read')) return ref;
  if (ref.metadata?.userUrls?.includes('plugin/user/read')) return ref;
  ts.createResponse('plugin/user/read', ref.url).subscribe();
  return readRef(ref);
}

export function readRef(ref: Ref): Ref {
  if (ref.metadata?.userUrls?.includes('plugin/user/read')) return ref;
  return { ...ref, metadata: { ...ref.metadata, userUrls: [...ref.metadata?.userUrls || [], 'plugin/user/read'] } };
}

/**
 * The server sets created and modified together when a Ref is created,
 * so a later modified date means the Ref was edited.
 */
export function isNewResponse(ref: Ref, maxAgeMs = 1_000) {
  if (!ref.created || !ref.modified) return false;
  return ref.modified.toMillis() - ref.created.toMillis() < maxAgeMs;
}

/**
 * Responses created after subscribing.
 * Response notifications are also sent for edits, so edited Refs are skipped.
 */
export function watchNewResponses(stomp: StompService, refs: RefService, url: string): Observable<Ref> {
  const seen = new Set<string>();
  return stomp.watchResponse(url).pipe(
    filter(res => res !== url && !res.startsWith('tag:') && !seen.has(res)),
    tap(res => seen.add(res)),
    mergeMap(res => refs.getCurrent(res).pipe(catchError(() => EMPTY))),
    filter(ref => isNewResponse(ref)),
  );
}
