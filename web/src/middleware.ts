import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionToken } from '@/lib/auth';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 認証APIは常に許可
  if (pathname === '/api/login' || pathname === '/api/logout' || pathname === '/api/health') {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authed = !!token && token === sessionToken();
  const isLogin = pathname === '/login';

  if (!authed && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname && pathname !== '/' ? `?from=${encodeURIComponent(pathname)}` : '';
    return NextResponse.redirect(url);
  }

  if (authed && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
