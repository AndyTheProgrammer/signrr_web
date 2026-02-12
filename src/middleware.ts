import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const path = request.nextUrl.pathname

  // Public paths that don't require authentication
  const isAuthPath = path === '/sign-in' || path === '/sign-up'

  // Guest signing path (doesn't require auth, uses magic token)
  const isGuestSigningPath = path.startsWith('/sign/')

  // If user is authenticated and trying to access auth pages, redirect to dashboard
  if (isAuthPath && user) {
    return NextResponse.redirect(new URL('/dashboard/home', request.url))
  }

  // Protected paths require authentication (unless it's a guest signing path)
  const isProtectedPath = path.startsWith('/dashboard')

  if (isProtectedPath && !user) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  // Root path: if logged in, go to dashboard; otherwise show landing page
  if (path === '/' && user) {
    return NextResponse.redirect(new URL('/dashboard/home', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}