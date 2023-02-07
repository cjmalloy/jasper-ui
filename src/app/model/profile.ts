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

const roleOrder = ['ROLE_SYSADMIN', 'ROLE_ADMIN', 'ROLE_MOD', 'ROLE_EDITOR', 'ROLE_USER', 'ROLE_VIEWER', 'ROLE_ANONYMOUS'];

export function getRole(...roles: (string | undefined)[]) {
  let index = roleOrder.indexOf('ROLE_ANONYMOUS');
  for (const r of roles) {
    index = Math.min(index, roleOrder.indexOf(r || ''));
  }
  return roleOrder[index];
}
