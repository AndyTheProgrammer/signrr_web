// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  const isPublicPath = path === '/sign-in' || path === '/sign-up'
  const token = request.cookies.get('token')?.value || ''
//   const token = 'authenticated'


  console.log("is Public Path: ", isPublicPath, "Token: " + token )

  if (isPublicPath && token) {
    return NextResponse.redirect(new URL('/dashboard/home', request.url))
  }

  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    '/',
    '/dashboard',
    '/sign-in',
    '/sign-up'
  ]
}