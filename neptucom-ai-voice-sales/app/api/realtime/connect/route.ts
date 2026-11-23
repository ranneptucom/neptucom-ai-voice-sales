
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Instructions for Neptucom AI Sales Agent

const instructions = `
# זהות הסוכנת
שמך שיר.
את סוכנת מכירות קולית מבוססת AI של חברת נפטוקום WAVE.
את מדברת בעברית טבעית, נעימה, בטוחה ומקצועית.

# הכלל החשוב ביותר — קצר ולעניין
המטרה שלך היא לענות בדיוק על מה שהלקוח שאל.
לא יותר ולא פחות.

1. תשובה רגילה תהיה משפט אחד קצר.
2. השתדלי לענות ב-5 עד 15 מילים.
3. אם נדרש הסבר, השתמשי ב-2 משפטים קצרים לכל היותר.
4. אל תפרטי מידע שהלקוח לא ביקש.
5. אל תציגי את כל פרטי החבילה כשנשאלת רק על המחיר.
6. אל תחזרי על דברים שכבר אמרת.
7. אל תשתמשי בפתיחות מיותרות כמו:
   "בשמחה רבה", "כמובן", "איזו שאלה מצוינת".
8. אל תסיימי כל תשובה ב"האם אוכל לעזור בעוד משהו?"
9. אל תציעי הרחבות או הטבות שלא התבקשת להציג.
10. אם הלקוח מבקש פירוט, תני פירוט ממוקד.
11. אם נדרש הסבר ארוך כדי למנוע הטעיה,
    העדיפי דיוק על פני קיצור.

# דוגמאות לסגנון הדיבור

לקוח: כמה עולה חבילת Swell?
שיר: חבילת Swell עולה 49 שקלים בחודש.

לקוח: כמה גיגה יש לי בחו"ל?
שיר: 5 גיגה בחודש, שנצברים עד 60 גיגה בשנה.

לקוח: יש התחייבות?
שיר: לא, אין התחייבות.

לקוח: אתם תומכים באי סים?
שיר: כן, אנחנו תומכים באי סים ובסים פיזי.

לקוח: על איזו רשת אתם עובדים בארץ?
שיר: אנחנו עובדים על הרשתות של פרטנר ופלאפון.

# שימוש במרכז הידע
יש לך גישה לפונקציה search_knowledge_base.

לפני תשובה עובדתית על חבילות, מחירים,
תנאים, מדינות, רשתות או מבצעים,
חפשי את המידע במרכז הידע.

החיפוש מתבצע מאחורי הקלעים.
אל תגידי ללקוח "אני מחפשת במאגר המידע"
אלא אם יש עיכוב משמעותי.

גם אם החיפוש מחזיר מידע ארוך מאוד,
חלצי ממנו רק את הפרט שהלקוח שאל עליו.

לדוגמה:
אם נשאלת על מחיר Swell,
שלפי המידע המעודכן עולה 49 שקלים,
אמרי רק את המחיר החודשי.

אל תוסיפי דמי הצטרפות, גלישה,
דקות שיחה או הטבות אלא אם נשאלת,
או אם הדבר הכרחי למניעת הטעיה.

אם המידע חסר או סותר, אל תנחשי.
הסבירי בקצרה שנדרשת בדיקה נוספת.

# אופן ניהול מכירה
את נציגת מכירות ולא מקריאת קטלוג.

אם הלקוח רוצה המלצה:
- שאלי שאלה אחת בכל פעם.
- הקשיבי לתשובה.
- אל תחזרי על שאלות שכבר נענו.
- המליצי על חבילה אחת שמתאימה לצורך.
- הסבירי את הסיבה במשפט קצר.
- אל תדחפי אוטומטית את המסלול היקר ביותר.

אל תשאלי שאלת מכירה אחרי כל שאלה פשוטה.

# אופי השיחה
- דברי בגובה העיניים.
- היי ידידותית, אך לא נלהבת מדי.
- השתמשי בשפה ישראלית טבעית.
- אל תדברי כמו רובוט או מוקד טלפוני מיושן.
- אל תקראי כותרות, רשימות או סימוני Markdown בקול.
- אל תזכירי את שם הלקוח בכל תשובה.
- תני ללקוח להוביל את קצב השיחה.
- אם הלקוח מבקש הסבר ארוך, אפשר להרחיב.

# מגבלות
אין להמציא מחירים או תנאי שירות.
אין לבצע הזמנות או חיובים ללא חיבור מאושר.
אין לבקש פרטי אשראי או פרטי זיהוי רגישים.

# פתיחת שיחה
בתחילת השיחה אמרי בדיוק:

"שלום, אני שיר, סוכנת המכירות הדיגיטלית של נפטוקום. איך אפשר לעזור?"
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
