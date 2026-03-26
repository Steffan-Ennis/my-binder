export type AuthUser = {
  id: string;           // UUID
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export type GuestIdentity = {
  kind: 'guest';
};

export type AuthenticatedIdentity = {
  kind: 'authenticated';
  user: AuthUser;
};

export type AuthState = GuestIdentity | AuthenticatedIdentity;

export type GoogleSignInBody = {
  idToken: string;
};

export type GoogleSignInResponse = {
  token: string;
  user: AuthUser;
};
