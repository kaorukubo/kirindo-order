export const SESSION_COOKIE = 'kirindo_session';

/** Cookie に格納するセッション値（本番は AUTH_SECRET を設定） */
export function sessionToken(): string {
  return process.env.AUTH_SECRET || 'kirindo-dev-secret';
}

/** テスト既定: admin / admin */
export function loginEmail(): string {
  return process.env.APP_LOGIN_EMAIL || 'admin';
}

export function loginPassword(): string {
  return process.env.APP_LOGIN_PASSWORD || 'admin';
}
