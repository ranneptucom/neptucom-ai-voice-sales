
'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

type Status =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'stopping'
  | 'error';

type FunctionCall = {
  type: 'function_call';
  name: string;
  call_id: string;
  arguments: string;
};

type RealtimeEvent = {
  type: string;
  error?: { message?: string };
  response?: {
    output?: Array<{
      type?: string;
      name?: string;
      call_id?: string;
      arguments?: string;
    }>;
  };
};

const labels: Record<Status, string> = {
  idle: 'מוכן לשיחה',
  connecting: 'מתחבר...',
  connected: 'השיחה פעילה',
  stopping: 'מסיים...',
  error: 'שגיאה בחיבור'
};

export default function Page() {
  const [status, setStatus] = useState<Status>('idle');
  const [code, setCode] = useState('');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<string[]>([]);

  const pc = useRef<RTCPeerConnection | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const busy = useRef(false);
  const handledCalls = useRef<Set<string>>(new Set());
  const accessCode = useRef('');
  const generation = useRef(0);

  const addLog = useCallback((message: string) => {
    setEvents(prev => [
      new Date().toLocaleTimeString('he-IL') +
        ' · ' + message,
      ...prev
    ].slice(0, 20));
  }, []);

  const sendEvent = useCallback((payload: object) => {
    const dc = channel.current;

    if (!dc || dc.readyState !== 'open') {
      return false;
    }

    dc.send(JSON.stringify(payload));
    return true;
  }, []);

  const stop = useCallback(() => {
    generation.current++;
    busy.current = false;

    channel.current?.close();
    channel.current = null;

    pc.current?.close();
    pc.current = null;

    stream.current
      ?.getTracks()
      .forEach(track => track.stop());

    stream.current = null;

    if (audio.current) {
      audio.current.srcObject = null;
      audio.current = null;
    }

    handledCalls.current.clear();

    setMuted(false);
    setStatus('idle');
    addLog('השיחה הסתיימה');
  }, [addLog]);

  useEffect(() => {
    return () => {
      channel.current?.close();
      pc.current?.close();
      stream.current?.getTracks().forEach(
        track => track.stop()
      );
    };
  }, []);

  // Search the Neptucom knowledge base.
  const searchKnowledge = useCallback(
    async (query: string) => {
      const response = await fetch(
        '/api/knowledge/search',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-demo-code': accessCode.current
          },
          body: JSON.stringify({ query }),
          cache: 'no-store'
        }
      );

      if (!response.ok) {
        throw new Error(
          'Knowledge API error: ' + response.status
        );
      }

      const data = await response.json();

      return data.results || [];
    },
    []
  );

  // Execute a tool requested by OpenAI Realtime.
  const executeFunction = useCallback(
    async (call: FunctionCall) => {
      if (!call.call_id) return;

      if (handledCalls.current.has(call.call_id)) {
        return;
      }

      handledCalls.current.add(call.call_id);

      const currentGeneration = generation.current;

      addLog('הסוכן מחפש מידע במרכז הידע...');

      let result: unknown;

      try {
        if (call.name !== 'search_knowledge_base') {
          result = {
            error: 'Unknown function'
          };
        } else {
          const args = JSON.parse(call.arguments || '{}');
          const query = args.query;

          if (
            typeof query !== 'string' ||
            query.trim().length < 2
          ) {
            throw new Error('Invalid search query');
          }

          addLog('חיפוש: ' + query.slice(0, 90));

          const results = await searchKnowledge(query);

          result = {
            query,
            results,
            found: results.length > 0,
            instruction:
              results.length > 0
                ? 'Answer using the retrieved knowledge only. If records conflict, request verification.'
                : 'No matching information found. Do not invent an answer.'
          };

          addLog(
            results.length > 0
              ? 'נמצאו ' + results.length + ' תוצאות במרכז הידע'
              : 'לא נמצא מידע מתאים במאגר'
          );
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unknown error';

        addLog('שגיאה בחיפוש: ' + message);

        result = {
          error: 'Knowledge search unavailable',
          instruction:
            'Tell the customer the information cannot be verified right now. Do not guess.'
        };
      }

      // Ignore results from a call that has already ended.
      if (generation.current !== currentGeneration) {
        return;
      }

      // Return the tool result to OpenAI.
      const sent = sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(result)
        }
      });

      if (!sent) {
        addLog('לא ניתן להחזיר תוצאה: החיבור נסגר');
        return;
      }

      // Ask the assistant to continue speaking
      // after receiving the knowledge result.
      sendEvent({
        type: 'response.create'
      });

      addLog('המידע הועבר לסוכן להמשך תשובה');
    },
    [addLog, searchKnowledge, sendEvent]
  );

  // Handle realtime events from the data channel.
  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      if (event.type === 'error') {
        const message =
          event.error?.message || 'שגיאת AI';

        setError(message);
        addLog('שגיאה מהסוכן: ' + message);
      }

      if (
        event.type ===
        'input_audio_buffer.speech_started'
      ) {
        addLog('זוהה דיבור של הלקוח');
      }

      if (event.type === 'response.done') {
        addLog('הסוכן סיים שלב בתשובה');

        const output = event.response?.output || [];

        for (const item of output) {
          if (
            item.type === 'function_call' &&
            item.name &&
            item.call_id
          ) {
            void executeFunction({
              type: 'function_call',
              name: item.name,
              call_id: item.call_id,
              arguments: item.arguments || '{}'
            });
          }
        }
      }
    },
    [addLog, executeFunction]
  );

  async function start() {
    if (busy.current || !code.trim()) return;

    busy.current = true;
    generation.current++;
    accessCode.current = code;
    handledCalls.current.clear();

    setError('');
    setStatus('connecting');
    setEvents([]);

    try {
      const mic =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });

      stream.current = mic;

      const peer = new RTCPeerConnection();
      pc.current = peer;

      mic.getTracks().forEach(track => {
        peer.addTrack(track, mic);
      });

      const output = new Audio();
      output.autoplay = true;
      audio.current = output;

      peer.ontrack = e => {
        output.srcObject = e.streams[0];

        output.play().catch(() => {
          addLog('יש לאפשר השמעת קול בדפדפן');
        });
      };

      peer.onconnectionstatechange = () => {
        if (
          peer.connectionState === 'failed' ||
          peer.connectionState === 'disconnected'
        ) {
          setError('חיבור המדיה נותק');
          stop();
          setStatus('error');
        }
      };

      const dc = peer.createDataChannel('oai-events');
      channel.current = dc;

      dc.onopen = () => {
        setStatus('connected');

        addLog('החיבור נוצר. אפשר להתחיל לדבר');

        sendEvent({
          type: 'response.create'
        });
      };

      dc.onmessage = event => {
        try {
          const message = JSON.parse(event.data);
          handleRealtimeEvent(message);
        } catch {
          addLog('התקבל אירוע לא תקין');
        }
      };

      const offer = await peer.createOffer();

      await peer.setLocalDescription(offer);

      if (peer.iceGatheringState !== 'complete') {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            peer.removeEventListener(
              'icegatheringstatechange',
              onIce
            );

            reject(
              new Error('ICE gathering timed out')
            );
          }, 12000);

          function onIce() {
            if (peer.iceGatheringState === 'complete') {
              clearTimeout(timer);

              peer.removeEventListener(
                'icegatheringstatechange',
                onIce
              );

              resolve();
            }
          }

          peer.addEventListener(
            'icegatheringstatechange',
            onIce
          );
        });
      }

      const response = await fetch(
        '/api/realtime/connect',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-demo-code': code
          },
          body: JSON.stringify({
            sdp: peer.localDescription?.sdp
          })
        }
      );

      if (!response.ok) {
        const json = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          json.error ||
            'שגיאת חיבור ' + response.status
        );
      }

      await peer.setRemoteDescription({
        type: 'answer',
        sdp: await response.text()
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'שגיאה לא ידועה';

      stop();

      setError(message);
      setStatus('error');
    } finally {
      busy.current = false;
    }
  }

  function toggleMute() {
    const next = !muted;

    stream.current
      ?.getAudioTracks()
      .forEach(track => {
        track.enabled = !next;
      });

    setMuted(next);
  }

  return (
    <main className="shell">
      <header className="header">
        <div className="brandmark">N</div>
        <div>
          <strong>NEPTUCOM</strong>
          <small>AI VOICE SALES / LAB</small>
        </div>
        <span className="pilot">גרסת ניסיון</span>
      </header>

      <section className="hero">
        <div className="eyebrow">
          VOICE AGENT · HEBREW
        </div>

        <h1>
          סוכן המכירות הקולי
          <br />
          <span>החדש של נפטוקום.</span>
        </h1>

        <p>
          מדברים עם סוכן AI בעברית טבעית,
          ישירות מהדפדפן. השיחה מתבצעת בזמן
          אמת באמצעות OpenAI Realtime.
        </p>
      </section>

      <section className="panel">
        <div className="status">
          <span className={'dot ' + status}></span>
          {labels[status]}
        </div>

        <div
          className={
            'orb ' +
            (status === 'connected' ? 'talking' : '')
          }
        >
          <div className="orbinner">◉</div>
        </div>

        <h2>
          {status === 'connected'
            ? 'אפשר לדבר עכשיו'
            : 'מוכנים לשיחת ניסיון?'}
        </h2>

        <p className="support">
          {status === 'connected'
            ? 'שאל על חבילות, מחירים, גלישה בחו"ל או חבילות משפחה.'
            : 'הסוכן יציג את עצמו ויענה מתוך מרכז הידע של נפטוקום.'}
        </p>

        <label
          className="fieldlabel"
          htmlFor="access"
        >
          קוד גישה לבדיקה
        </label>

        <input
          id="access"
          type="password"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="הקוד שהגדרת ב־Vercel"
          autoComplete="off"
          disabled={
            status === 'connected' ||
            status === 'connecting'
          }
        />

        <div className="actions">
          {status === 'connected' ? (
            <>
              <button
                className="secondary"
                onClick={toggleMute}
              >
                {muted
                  ? 'ביטול השתקה'
                  : 'השתק מיקרופון'}
              </button>

              <button
                className="hangup"
                onClick={stop}
              >
                סיום שיחה
              </button>
            </>
          ) : (
            <button
              className="primary"
              disabled={
                status === 'connecting' ||
                !code.trim()
              }
              onClick={start}
            >
              {status === 'connecting'
                ? 'מתחבר לשיחה...'
                : '🎙 התחלת שיחה בעברית'}
            </button>
          )}
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <p className="notice">
          גרסת ניסיון עם חיבור למרכז הידע
          של WAVE. ללא SIP, Fireberry
          או ביצוע הזמנות בשלב זה.
        </p>
      </section>

      <section className="lower">
        <div className="info">
          <h3>מה הסוכן כבר יודע?</h3>
          <p>
            מידע על מסלולי WAVE, מחירים,
            חבילות משפחתיות, מדינות,
            רשתות נתמכות, ניודים ו־eSIM.
          </p>
        </div>

        <div className="info">
          <h3>מה נבנה בהמשך?</h3>
          <p>
            חיבור SIP למספר הקיים,
            יצירת לידים ב־Fireberry
            והשלמת הזמנות.
          </p>
        </div>
      </section>

      <section className="log">
        <h3>אירועי שיחה ומרכז הידע</h3>

        {events.length ? (
          events.map((event, index) => (
            <div key={index}>{event}</div>
          ))
        ) : (
          <p>
            אירועי חיבור וחיפוש במרכז הידע
            יופיעו כאן.
          </p>
        )}
      </section>

      <footer>
        Neptucom Voice Lab ·
        Internal prototype · © 2026
      </footer>
    </main>
  );
}
