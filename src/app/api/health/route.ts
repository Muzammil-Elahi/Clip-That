/**
 * Health check endpoint for Vercel deployment verification.
 * GET /api/health → { status: 'ok' } with HTTP 200.
 */
export async function GET() {
  return Response.json({ status: 'ok' }, { status: 200 })
}
