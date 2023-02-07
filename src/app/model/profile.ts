export interface Profile {
  tag: string;
  active?: boolean;
  password?: string;
  role?: string;
}

export type ProfilePageArgs = {
  page?: number,
  size?: number,
};

const roleOrder = ['ROLE_ANONYMOUS', 'ROLE_VIEWER', 'ROLE_USER', 'ROLE_EDITOR', 'ROLE_MOD', 'ROLE_ADMIN', 'ROLE_SYSADMIN'];

export function getRole(...roles: (string | undefined)[]) {
  let index = 0;
  for (const r of roles) {
    index = Math.max(index, roleOrder.indexOf(r || ''));
  }
  return roleOrder[index];
}
