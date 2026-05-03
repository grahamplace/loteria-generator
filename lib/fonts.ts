import { Geist, Geist_Mono, Caveat, Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';

export const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
export const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });
export const caveat = Caveat({ subsets: ['latin'], variable: '--font-caveat' });
export const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});
export const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const fontVariables = `${geist.variable} ${geistMono.variable} ${caveat.variable} ${bricolage.variable} ${jetbrains.variable}`;
