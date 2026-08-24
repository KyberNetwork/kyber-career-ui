import { type NextRequest, NextResponse } from 'next/server'

// Requests for the literal dynamic segment (e.g. "/%5BpageId%5D") must never
// reach ISR: rendering a page for the slug "[pageId]" writes its HTML to the
// same cache path as the fallback shell for `pages/[pageId].tsx`, poisoning
// the fallback served for every not-yet-generated page.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.includes('[') || pathname.includes('%5B')) {
    return new NextResponse(null, { status: 404 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/|api/).*)']
}
