
import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledge } from '../../../../lib/knowledge';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const requiredCode = process.env.DEMO_ACCESS_CODE;

  if (!requiredCode) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 503 }
    );
  }

  if (req.headers.get('x-demo-code') !== requiredCode) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const origin = req.headers.get('origin');

  if (origin && new URL(origin).host !== req.nextUrl.host) {
    return NextResponse.json(
      { error: 'Origin not allowed' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const query = body?.query;

    if (
      typeof query !== 'string' ||
      query.length < 2 ||
      query.length > 500
    ) {
      return NextResponse.json(
        { error: 'Invalid query' },
        { status: 400 }
      );
    }

    const results = await searchKnowledge(query, 5);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Knowledge search failed', error);

    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
