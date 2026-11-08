import { Ref } from '../model/ref';
import { AdminService } from '../service/admin.service';
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
