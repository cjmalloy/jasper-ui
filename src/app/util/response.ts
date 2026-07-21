import { Ref } from '../model/ref';
import { AdminService } from '../service/admin.service';
import { TaggingService } from '../service/api/tagging.service';

export function markRead(admin: AdminService, ts: TaggingService, ref: Ref) {
  if (!admin.getPlugin('plugin/user/read')) return;
  if (ref.metadata?.userUrls?.includes('plugin/user/read')) return;
  ref.metadata ||= {};
  ref.metadata.userUrls ||= [];
  ref.metadata.userUrls.push('plugin/user/read');
  ts.createResponse('plugin/user/read', ref.url).subscribe();
}
