import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {title: 'Neptucom AI Voice Sales', description: 'Private Hebrew AI sales voice testing console'};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="he" dir="rtl"><body>{children}</body></html>;
}
