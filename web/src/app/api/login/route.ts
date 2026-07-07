import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionToken, loginEmail, loginPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (String(email).trim() === loginEmail() && String(password) === loginPassword()) {
      const res = NextResponse.json({ success: true });
      res.cookies.set(SESSION_COOKIE, sessionToken(), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        secure: process.env.NODE_ENV === 'production',
      });
      return res;
    }
    return NextResponse.json(
      { success: false, message: 'メールアドレスまたはパスワードが違います' },
      { status: 401 }
    );
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
