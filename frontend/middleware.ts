import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This is the REQUIRED middleware function export
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const token = request.cookies.get('auth_token')?.value;

  // Public paths that don't require authentication
  const publicPaths = ['/auth/sign-in', '/auth/sign-up', '/unauthorized'];
  
  // Check if path is public
  if (publicPaths.includes(path) || path.startsWith('/_next/') || path.startsWith('/public/')) {
    return NextResponse.next();
  }

  // If no token and trying to access protected route, redirect to login
  if (!token && !path.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  }

  return NextResponse.next();
}

// This config is OPTIONAL but recommended
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

// You can also export as default if you prefer:
// export default middleware;