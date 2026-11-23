# Neptucom AI Voice Sales — MVP 1

Standalone Hebrew-speaking browser voice demo using Next.js, WebRTC and OpenAI Realtime API. This project is intentionally **not** integrated with SIP, Fireberry or checkout yet.

## Run locally

1. Install Node.js 20+.
2. `npm install`
3. Copy `.env.example` to `.env.local`.
4. Set `OPENAI_API_KEY` (server-only; never expose it) and `DEMO_ACCESS_CODE` (long, random test access code).
5. `npm run dev` and open http://localhost:3000.
6. Enter test access code, enable microphone, click "התחלת שיחה בעברית".

The test starts a billable OpenAI Realtime WebRTC call. Browser microphone permissions require HTTPS or localhost.

## Deploy via GitHub + Vercel

1. Create a **private** GitHub repository named `neptucom-ai-voice-sales`.
2. Upload project files (do not upload `.env.local` or `node_modules`).
3. In Vercel choose **Add New > Project > Import Git Repository**.
4. Set env vars under Project Settings > Environment Variables:
   - `OPENAI_API_KEY`
   - `DEMO_ACCESS_CODE`
   - `OPENAI_REALTIME_MODEL` (optional, default `gpt-realtime-2.1`)
5. Deploy. Restrict website access with Vercel Deployment Protection / trusted users. The shared test code is basic protection only.
6. Test on Chrome with mic permission, preferably using headphones.

## How it works

`app/page.tsx`: React client creates an RTCPeerConnection and data channel; gets mic; sends SDP offer to backend; installs SDP answer; starts speech with `response.create`; plays agent audio from remote media track. Stop closes tracks and PeerConnection.

`app/api/realtime/connect/route.ts`: receives SDP offer, checks demo passcode and same-origin request, makes `multipart/form-data` POST to `https://api.openai.com/v1/realtime/calls` including session config and server-side OpenAI API key, returns SDP answer. Does not expose key to browser.

## Security / launch checklist

- Keep this MVP private; before external use add real authentication, durable rate limits, abuse monitoring, cost ceilings and secure access to logs.
- Current demo code is not production-grade authentication. Don't use a shared test code as your only control for public launch.
- AI cannot quote verified live prices, enter CRM, place orders or transfer calls in this version.
- Avoid real customer personal information until privacy, notices and retention policies are established.
- In phase 2 add a backend SIP/webhook handler, validate OpenAI webhook signatures and provider trunk settings, and implement human escalation.
- For production add tool validation and customer consent / verification before CRM updates and order actions.

## Useful docs

- https://developers.openai.com/api/docs/guides/voice-webrtc
- https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/create
