
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Instructions for Neptucom AI Sales Agent
const instructions = `
אתה סוכן המכירות הקולי החכם של חברת נפטוקום WAVE.

# אופן הדיבור
- דבר בעברית טבעית, נעימה ומקצועית.
- השתמש במשפטים קצרים המתאימים לשיחה טלפונית.
- שאל שאלה אחת בכל פעם.
- אל תקטע את הלקוח.
- הצג את עצמך כסוכן AI בתחילת השיחה.

# מרכז המידע
לרשותך פונקציה בשם search_knowledge_base.

בכל שאלה על:
- מחירי חבילות ומסלולים
- גלישה בישראל ובחו"ל
- דקות שיחה והודעות SMS
- דמי הצטרפות ועלויות נוספות
- חבילות משפחתיות
- מדינות ורשתות נתמכות
- eSIM ו-SIM פיזי
- ניוד מספרים
- תנאי השירות
- מבצעים והטבות

עליך להפעיל את search_knowledge_base לפני מתן תשובה.

אין להמציא מחירים, תנאים או פרטי מוצר.
השתמש במידע שהוחזר ממאגר הידע.

אם המידע חסר או סותר, הסבר ללקוח
שנדרשת בדיקה נוספת.

מבצעים תקפים רק בהתאם לתאריכים
ולתנאים שמופיעים במרכז הידע.

# תהליך מכירה
כאשר לקוח מעוניין להצטרף:

1. ברר כמה קווים הוא צריך.
2. ברר אם הוא טס לחו"ל ובאיזו תדירות.
3. ברר אם חשובות לו שיחות וגלישה בחו"ל.
4. חפש את המסלולים המתאימים במרכז הידע.
5. המלץ על המסלול המתאים לצרכיו.
6. הצג את המחיר החודשי.
7. הצג בנפרד דמי הצטרפות ועלויות נוספות.
8. שאל אם הוא מעוניין להתקדם לרכישה.

אין להמליץ אוטומטית על המסלול היקר ביותר.

# הגבלות
אינך מחובר עדיין למערכת ההזמנות.
אין לטעון שביצעת הזמנה או חיוב.
אין לבקש פרטי אשראי או תעודת זהות.
אם הלקוח מבקש נציג אנושי, הסבר
שהעברה לנציג עדיין אינה זמינה בדמו.

# פתיחת שיחה
בתחילת השיחה אמור:

"שלום! הגעת לנפטוקום.
אני סוכן המכירות הקולי החכם שלנו.
איך אפשר לעזור לך היום?"
`;

// Knowledge search function
const tools = [
  {
    type: 'function',
    name: 'search_knowledge_base',
    description:
      'Search the official Neptucom WAVE knowledge base for product information, pricing, plans, coverage, roaming, eSIM, policies and sales questions.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'A focused Hebrew search query describing the customer question.'
        }
      },
      required: ['query'],
      additionalProperties: false
    }
  }
];

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const requiredCode = process.env.DEMO_ACCESS_CODE;

  if (!apiKey || !requiredCode) {
    return NextResponse.json(
      {
        error:
          'Missing OPENAI_API_KEY or DEMO_ACCESS_CODE'
      },
      { status: 503 }
    );
  }

  // Demo authentication
  if (req.headers.get('x-demo-code') !== requiredCode) {
    return NextResponse.json(
      { error: 'Invalid access code' },
      { status: 401 }
    );
  }

  // Origin validation
  const origin = req.headers.get('origin');

  if (origin) {
    try {
      if (new URL(origin).host !== req.nextUrl.host) {
        return NextResponse.json(
          { error: 'Origin not allowed' },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid origin' },
        { status: 403 }
      );
    }
  }

  // Read SDP offer
  let data: unknown;

  try {
    data = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const sdp = (data as { sdp?: unknown })?.sdp;

  if (
    typeof sdp !== 'string' ||
    sdp.length < 100 ||
    sdp.length > 60000 ||
    !sdp.startsWith('v=0')
  ) {
    return NextResponse.json(
      { error: 'Invalid SDP offer' },
      { status: 400 }
    );
  }

  // OpenAI Realtime session
  const session = {
    type: 'realtime',
    model:
      process.env.OPENAI_REALTIME_MODEL ||
      'gpt-realtime-2.1',
    instructions,
    tools,
    tool_choice: 'auto'
  };

  // Multipart form
  const form = new FormData();

  form.set('sdp', sdp);
  form.set('session', JSON.stringify(session));

  try {
    const upstream = await fetch(
      'https://api.openai.com/v1/realtime/calls',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: form,
        cache: 'no-store',
        signal: AbortSignal.timeout(25000)
      }
    );

    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(
        0,
        800
      );

      console.error(
        'Realtime connection failed:',
        upstream.status,
        detail
      );

      return NextResponse.json(
        {
          error:
            `OpenAI connection failed (${upstream.status}). Check server logs.`
        },
        { status: 502 }
      );
    }

    const answer = await upstream.text();

    return new NextResponse(answer, {
      status: 200,
      headers: {
        'Content-Type': 'application/sdp',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error(
      'Realtime upstream exception:',
      error
    );

    return NextResponse.json(
      { error: 'Failed to contact realtime service' },
      { status: 502 }
    );
  }
}
