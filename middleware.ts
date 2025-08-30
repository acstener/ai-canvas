// No authentication middleware - allow all routes
export default function middleware() {
  // No auth checks - just allow everything through
  return;
}

export const config = {
  // Empty matcher so middleware doesn't run on any routes
  matcher: [],
};