'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type Status = 'idle'|'connecting'|'connected'|'stopping'|'error';
const labels:Record<Status,string>={idle:'מוכן לשיחה',connecting:'מתחבר...',connected:'השיחה פעילה',stopping:'מסיים...',error:'שגיאה בחיבור'};
export default function Page() {
  const [status,setStatus]=useState<Status>('idle');
  const [code,setCode]=useState('');
  const [muted,setMuted]=useState(false);
  const [error,setError]=useState('');
  const [events,setEvents]=useState<string[]>([]);
  const pc=useRef<RTCPeerConnection|null>(null);
  const stream=useRef<MediaStream|null>(null);
  const channel=useRef<RTCDataChannel|null>(null);
  const audio=useRef<HTMLAudioElement|null>(null);
  const busy=useRef(false);
  const addLog=useCallback((s:string)=>setEvents(prev=>[new Date().toLocaleTimeString('he-IL')+' · '+s,...prev].slice(0,12)),[]);
  const stop=useCallback(()=>{
    busy.current=false;
    try { if(channel.current?.readyState==='open') channel.current.send(JSON.stringify({type:'session.close'})); } catch {}
    channel.current?.close();channel.current=null;
    pc.current?.close();pc.current=null;
    stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;
    if(audio.current){audio.current.srcObject=null; audio.current=null;}
    setMuted(false);setStatus('idle');addLog('השיחה הסתיימה');
  },[addLog]);
  useEffect(()=>()=>{pc.current?.close();stream.current?.getTracks().forEach(t=>t.stop());},[]);
  async function start(){
    if(busy.current || !code.trim())return;
    busy.current=true;setError('');setStatus('connecting');setEvents([]);
    try {
      const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
      stream.current=mic;
      const peer=new RTCPeerConnection();pc.current=peer;
      mic.getTracks().forEach(track=>peer.addTrack(track,mic));
      const output=new Audio();output.autoplay=true;audio.current=output;
      peer.ontrack=e=>{output.srcObject=e.streams[0];output.play().catch(()=>addLog('יש לאפשר השמעת קול בדפדפן'));};
      peer.onconnectionstatechange=()=>{
        if(peer.connectionState==='failed'||peer.connectionState==='disconnected'){
          setError('חיבור המדיה נותק');stop();setStatus('error');
        }
      };
      const dc=peer.createDataChannel('oai-events');channel.current=dc;
      dc.onopen=()=>{
        setStatus('connected');addLog('החיבור נוצר. אפשר להתחיל לדבר');
        dc.send(JSON.stringify({type:'response.create'}));
      };
      dc.onmessage=event=>{
        try {
          const msg=JSON.parse(event.data);
          if(msg.type==='error') {setError(msg.error?.message||'שגיאת AI');addLog('שגיאה מהסוכן');}
          if(msg.type==='response.done') addLog('הסוכן סיים לענות');
          if(msg.type==='input_audio_buffer.speech_started') addLog('הסוכן מאזין ללקוח');
        }catch{}
      };
      const offer=await peer.createOffer();await peer.setLocalDescription(offer);
      // Wait for ICE gathering to complete for reliable SDP exchange.
      if(peer.iceGatheringState!=='complete')await new Promise<void>((resolve,reject)=>{
        const t=setTimeout(()=>{peer.removeEventListener('icegatheringstatechange',onIce);reject(new Error('ICE gathering timed out'));},12000);
        function onIce(){if(peer.iceGatheringState==='complete'){clearTimeout(t);peer.removeEventListener('icegatheringstatechange',onIce);resolve();}}
        peer.addEventListener('icegatheringstatechange',onIce);
      });
      const response=await fetch('/api/realtime/connect',{method:'POST',headers:{'Content-Type':'application/json','x-demo-code':code},body:JSON.stringify({sdp:peer.localDescription?.sdp})});
      if(!response.ok){const json=await response.json().catch(()=>({}));throw new Error(json.error||'שגיאת חיבור '+response.status);}
      await peer.setRemoteDescription({type:'answer',sdp:await response.text()});
    }catch(e){const message=e instanceof Error?e.message:'שגיאה לא ידועה';setError(message);stop();setStatus('error');}
    finally{busy.current=false;}
  }
  function toggleMute(){const next=!muted;stream.current?.getAudioTracks().forEach(t=>t.enabled=!next);setMuted(next);}
  return <main className="shell">
    <header className="header"><div className="brandmark">N</div><div><strong>NEPTUCOM</strong><small>AI VOICE SALES / LAB</small></div><span className="pilot">גרסת ניסיון</span></header>
    <section className="hero"><div className="eyebrow">VOICE AGENT · HEBREW</div><h1>סוכן המכירות הקולי<br/><span>החדש של נפטוקום.</span></h1><p>מדברים עם סוכן AI בעברית טבעית, ישירות מהדפדפן. השיחה מתבצעת בזמן אמת באמצעות OpenAI Realtime.</p></section>
    <section className="panel"><div className="status"><span className={'dot '+status}></span>{labels[status]}</div><div className={'orb '+(status==='connected'?'talking':'')}><div className="orbinner">◉</div></div><h2>{status==='connected'?'אפשר לדבר עכשיו':'מוכנים לשיחת ניסיון?'}</h2><p className="support">{status==='connected'?'ספר לסוכן מה אתה מחפש, לדוגמה חבילת משפחה עם גלישה בחו״ל.':'הסוכן יציג את עצמו וינהל איתך שיחת מכירה לדוגמה.'}</p>
      <label className="fieldlabel" htmlFor="access">קוד גישה לבדיקה</label><input id="access" type="password" value={code} onChange={e=>setCode(e.target.value)} placeholder="הקוד שהגדרת ב־Vercel" autoComplete="off" disabled={status==='connected'||status==='connecting'}/>
      <div className="actions">{status==='connected'?<><button className="secondary" onClick={toggleMute}>{muted?'ביטול השתקה':'השתק מיקרופון'}</button><button className="hangup" onClick={stop}>סיום שיחה</button></>:<button className="primary" disabled={status==='connecting'||!code.trim()} onClick={start}>{status==='connecting'?'מתחבר לשיחה...':'🎙 התחלת שיחה בעברית'}</button>}</div>
      {error&&<p className="error" role="alert">{error}</p>}
      <p className="notice">בדיקת קול בלבד · לא מחובר עדיין ל־SIP, ל־Fireberry או למערכת הזמנות. השיחה עשויה להיות מחויבת לפי תעריפי OpenAI API.</p>
    </section>
    <section className="lower"><div className="info"><h3>מה הסוכן כבר יודע?</h3><p>פתיחת שיחה בעברית, בירור צרכים, קווים חדשים, חבילות משפחה וגלישה בחו״ל — ללא המצאת מחירים.</p></div><div className="info"><h3>מה נבנה בהמשך?</h3><p>חיבור SIP למספר הקיים, קריאת חבילות אמת, יצירת לידים ב־Fireberry והשלמת הזמנות.</p></div></section>
    <section className="log"><h3>אירועי שיחה</h3>{events.length?events.map((e,i)=><div key={i}>{e}</div>):<p>אירועי חיבור ובדיקת שיחה יופיעו כאן.</p>}</section>
    <footer>Neptucom Voice Lab · Internal prototype · © 2026</footer>
  </main>;
}
