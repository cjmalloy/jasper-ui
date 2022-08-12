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
