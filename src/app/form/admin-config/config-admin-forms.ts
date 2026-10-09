import { FormlyFieldConfig } from '@ngx-formly/core';

const roles = [
  { value: 'ROLE_ANONYMOUS', label: $localize`Anonymous` },
  { value: 'ROLE_VIEWER', label: $localize`Viewer` },
  { value: 'ROLE_USER', label: $localize`User` },
  { value: 'ROLE_EDITOR', label: $localize`Editor` },
  { value: 'ROLE_MOD', label: $localize`Mod` },
  { value: 'ROLE_ADMIN', label: $localize`Admin` },
];

function strings(key: string, label: string, addText: string): FormlyFieldConfig {
  return {
    key,
    type: 'list',
    props: {
      label,
      addText,
    },
    fieldArray: {
      type: 'string',
    },
  };
}

/**
 * Blank entries are the root origin, so they must not be removed on blur.
 */
function origins(key: string, label: string): FormlyFieldConfig {
  return {
    key,
    type: 'list',
    props: {
      label,
      addText: $localize`+ Add another origin`,
      keepBlank: true,
    },
    fieldArray: {
      type: 'origin',
    },
  };
}

function role(key: string, label: string): FormlyFieldConfig {
  return {
    key,
    type: 'select',
    props: {
      label,
      options: roles,
    },
  };
}

export const indexConfigAdminForm: FormlyFieldConfig[] = [
  { key: 'tags', type: 'boolean', props: { label: $localize`Tags:` } },
  { key: 'sources', type: 'boolean', props: { label: $localize`Sources:` } },
  { key: 'alts', type: 'boolean', props: { label: $localize`Alternate URLs:` } },
  { key: 'responses', type: 'boolean', props: { label: $localize`Responses:` } },
  { key: 'internalResponses', type: 'boolean', props: { label: $localize`Internal Responses:` } },
  { key: 'fulltext', type: 'boolean', props: { label: $localize`Full Text:` } },
  { key: 'published', type: 'boolean', props: { label: $localize`Published:` } },
  { key: 'modified', type: 'boolean', props: { label: $localize`Modified:` } },
];

export const securityConfigAdminForm: FormlyFieldConfig[] = [
  {
    key: 'mode',
    type: 'select',
    props: {
      label: $localize`Mode:`,
      options: [
        { value: '', label: $localize`None` },
        { value: 'jwt', label: $localize`JWT` },
        { value: 'jwks', label: $localize`JWKS` },
      ],
    },
  },
  { key: 'clientId', type: 'string', props: { label: $localize`Client ID:` } },
  { key: 'base64Secret', type: 'string', props: { label: $localize`Base64 Secret:`, type: 'password' } },
  { key: 'secret', type: 'string', props: { label: $localize`Secret:`, type: 'password' } },
  { key: 'jwksUri', type: 'url', props: { label: $localize`JWKS URI:` } },
  { key: 'tokenEndpoint', type: 'url', props: { label: $localize`Token Endpoint:` } },
  { key: 'scimEndpoint', type: 'url', props: { label: $localize`SCIM Endpoint:` } },
  { key: 'usernameClaim', type: 'string', props: { label: $localize`Username Claim:` } },
  { key: 'externalId', type: 'boolean', props: { label: $localize`External ID:` } },
  { key: 'emailDomainInUsername', type: 'boolean', props: { label: $localize`Email Domain in Username:` } },
  { key: 'rootEmailDomain', type: 'string', props: { label: $localize`Root Email Domain:` } },
  { key: 'verifiedEmailClaim', type: 'string', props: { label: $localize`Verified Email Claim:` } },
  { key: 'authoritiesClaim', type: 'string', props: { label: $localize`Authorities Claim:` } },
  { key: 'readAccessClaim', type: 'string', props: { label: $localize`Read Access Claim:` } },
  { key: 'writeAccessClaim', type: 'string', props: { label: $localize`Write Access Claim:` } },
  { key: 'tagReadAccessClaim', type: 'string', props: { label: $localize`Tag Read Access Claim:` } },
  { key: 'tagWriteAccessClaim', type: 'string', props: { label: $localize`Tag Write Access Claim:` } },
  role('minRole', $localize`Minimum Role:`),
  role('minWriteRole', $localize`Minimum Write Role:`),
  role('minFetchRole', $localize`Minimum Fetch Role:`),
  role('minConfigRole', $localize`Minimum Config Role:`),
  role('minReadBackupsRole', $localize`Minimum Read Backups Role:`),
  role('defaultRole', $localize`Default Role:`),
  { key: 'defaultUser', type: 'user', props: { label: $localize`Default User:` } },
  { key: 'defaultReadAccess', type: 'qtags', props: { label: $localize`Default Read Access:` } },
  { key: 'defaultWriteAccess', type: 'qtags', props: { label: $localize`Default Write Access:` } },
  { key: 'defaultTagReadAccess', type: 'qtags', props: { label: $localize`Default Tag Read Access:` } },
  { key: 'defaultTagWriteAccess', type: 'qtags', props: { label: $localize`Default Tag Write Access:` } },
  { key: 'maxRequests', type: 'integer', props: { label: $localize`Max Requests:` } },
  { key: 'maxConcurrentScripts', type: 'integer', props: { label: $localize`Max Concurrent Scripts:` } },
];

export const serverConfigAdminForm: FormlyFieldConfig[] = [
  { key: 'emailHost', type: 'string', props: { label: $localize`Email Host:` } },
  { key: 'maxSources', type: 'integer', props: { label: $localize`Max Sources:` } },
  { key: 'modSeals', type: 'tags', props: { label: $localize`Mod Seals:` } },
  { key: 'editorSeals', type: 'tags', props: { label: $localize`Editor Seals:` } },
  origins('webOrigins', $localize`Web Origins:`),
  origins('sshOrigins', $localize`SSH Origins:`),
  { key: 'scriptSelectors', type: 'selectors', props: { label: $localize`Script Selectors:`, keepBlank: true } },
  strings('scriptWhitelist', $localize`Script Whitelist:`, $localize`+ Add another script hash`),
  strings('hostWhitelist', $localize`Host Whitelist:`, $localize`+ Add another host`),
  strings('hostBlacklist', $localize`Host Blacklist:`, $localize`+ Add another host`),
  { key: 'maxReplEntityBatch', type: 'integer', props: { label: $localize`Max Replicate Entity Batch:` } },
  { key: 'maxPushEntityBatch', type: 'integer', props: { label: $localize`Max Push Entity Batch:` } },
  { key: 'maxPullEntityBatch', type: 'integer', props: { label: $localize`Max Pull Entity Batch:` } },
  { key: 'maxConcurrentScripts', type: 'integer', props: { label: $localize`Max Concurrent Scripts:` } },
  { key: 'maxConcurrentReplication', type: 'integer', props: { label: $localize`Max Concurrent Replication:` } },
  { key: 'maxRequests', type: 'integer', props: { label: $localize`Max Requests:` } },
  { key: 'maxConcurrentRequests', type: 'integer', props: { label: $localize`Max Concurrent Requests:` } },
  { key: 'maxConcurrentFetch', type: 'integer', props: { label: $localize`Max Concurrent Fetch:` } },
  {
    key: 'storage',
    type: 'select',
    props: {
      label: $localize`Storage:`,
      options: [
        { value: 'local', label: $localize`Local` },
        { value: 'gcs', label: $localize`Google Cloud Storage` },
        { value: 's3', label: $localize`S3` },
      ],
    },
  },
  { key: 'storageBucket', type: 'string', props: { label: $localize`Storage Bucket:` } },
];

/**
 * Hard coded admin forms for server config templates which do not define their own.
 */
export function configAdminFallback(tag: string): FormlyFieldConfig[] | undefined {
  if (tag === '_config/index') return indexConfigAdminForm;
  if (tag === '_config/security') return securityConfigAdminForm;
  if (tag === '_config/server' || tag.startsWith('_config/server/')) return serverConfigAdminForm;
  return undefined;
}
