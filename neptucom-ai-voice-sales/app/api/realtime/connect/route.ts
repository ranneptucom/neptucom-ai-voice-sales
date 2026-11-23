import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const instructions = `אתה סוכן מכירות קולי מבוסס בינה מלאכותית של חברת נפטוקום.
דבר בעברית טבעית, נעימה ומקצועית במשפטים קצרים. בתחילת השיחה הצג את עצמך כסוכן AI.
הלקוח מתקשר לבירור לגבי חבילות סלולר, קווים חדשים, ניוד מספר, שיחות וגלישה בחו"ל וחבילות משפחתיות.
שאל שאלה אחת בכל פעם. שאל מה הלקוח צריך, כמה קווים, והאם חשובה לו גלישה בחו"ל.
אל תמציא מחירים, הטבות, כמויות גלישה, זמינות רשת, התחייבויות או תנאי שירות.
אין לך כרגע גישה למחירון אמיתי או למערכות החברה; כששואלים על מחיר מסוים, הסבר שאתה בגרסת הדגמה ואין לך כרגע מחיר מעודכן.
אל תבקש פרטי תשלום, תעודת זהות, או פרטים מזהים רגישים. אל תטען שיצרת הזמנה או ליד.
כשהלקוח רוצה לבצע רכישה, הסבר שכרגע מדובר בהדגמה בלבד והשלמת הזמנה תהיה זמינה לאחר חיבור המערכת.
אם הלקוח מבקש נציג, הסבר שבגרסה זו אין עדיין העברה לשיחה אנושית.
בהתחלת השיחה אמור: "שלום! אני הסוכן הקולי החכם של נפטוקום. כרגע אנחנו בשיחת הדגמה. איך אוכל לעזור לך?"`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const requiredCode = process.env.DEMO_ACCESS_CODE;
  if (!apiKey || !requiredCode) {
    return NextResponse.json({error:'חסרות הגדרות שרת OPENAI_API_KEY או DEMO_ACCESS_CODE'}, {status:503});
  }
  if (req.headers.get('x-demo-code') !== requiredCode) {
    return NextResponse.json({error:'קוד גישה שגוי'}, {status:401});
  }
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.nextUrl.host) {
    return NextResponse.json({error:'Origin not allowed'}, {status:403});
  }
  let data: unknown;
  try { data = await req.json(); } catch { return NextResponse.json({error:'Invalid JSON'}, {status:400}); }
  const sdp = (data as {sdp?:unknown})?.sdp;
  if (typeof sdp !== 'string' || sdp.length < 100 || sdp.length > 60000 || !sdp.startsWith('v=0')) {
    return NextResponse.json({error:'Invalid SDP offer'}, {status:400});
  }
  
const form = new FormData();

form.set('sdp', sdp);

form.set('session', JSON.stringify({
  type: 'realtime',
  model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1',
  instructions
}));

  try {
    const upstream = await fetch('https://api.openai.com/v1/realtime/calls', {
      method:'POST', headers:{Authorization:`Bearer ${apiKey}`}, body:form, cache:'no-store', signal:AbortSignal.timeout(25000)
    });
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0,800);
      console.error('Realtime connection failed:',upstream.status,detail);
      return NextResponse.json({error:`OpenAI connection failed (${upstream.status}). Check server logs and API access.`},{status:502});
    }
    const answer = await upstream.text();
    return new NextResponse(answer,{status:200,headers:{'Content-Type':'application/sdp','Cache-Control':'no-store'}});
  } catch(err) {
    console.error('Realtime upstream exception',err);
    return NextResponse.json({error:'Failed to contact realtime service'}, {status:502});
  }
}
