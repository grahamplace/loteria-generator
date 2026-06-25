import { revalidatePath } from 'next/cache';
import {
  getUnsubscribeStateByToken,
  unsubscribeByToken,
  resubscribeByToken,
} from '@/lib/email/unsubscribe';

export const metadata = {
  title: 'Email preferences · Lotería',
  robots: { index: false, follow: false },
};

const COPY = {
  en: {
    title: 'Email preferences',
    invalid: 'This unsubscribe link is no longer valid. Please use the link from a recent email.',
    subscribedHeading: 'You are subscribed',
    subscribedBody: 'You are currently receiving occasional Lotería emails about your boards.',
    unsubscribeBtn: 'Unsubscribe',
    doneHeading: 'You have been unsubscribed',
    doneBody: 'You will no longer receive marketing emails from Lotería. Changed your mind?',
    resubscribeBtn: 'Re-subscribe',
    note: 'This only affects marketing emails. Important account emails (like password resets) are always sent.',
  },
  es: {
    title: 'Preferencias de correo',
    invalid: 'Este enlace para darte de baja ya no es válido. Usa el enlace de un correo reciente.',
    subscribedHeading: 'Estás suscrito',
    subscribedBody: 'Actualmente recibes correos ocasionales de Lotería sobre tus tablas.',
    unsubscribeBtn: 'Darme de baja',
    doneHeading: 'Te has dado de baja',
    doneBody: 'Ya no recibirás correos de marketing de Lotería. ¿Cambiaste de opinión?',
    resubscribeBtn: 'Volver a suscribirme',
    note: 'Esto solo afecta los correos de marketing. Los correos importantes de tu cuenta (como restablecer la contraseña) siempre se envían.',
  },
} as const;

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; lang?: string }>;
}) {
  const { token = '', lang } = await searchParams;
  const t = COPY[lang === 'es' ? 'es' : 'en'];
  const state = await getUnsubscribeStateByToken(token);

  async function unsubscribe() {
    'use server';
    await unsubscribeByToken(token);
    revalidatePath('/unsubscribe');
  }

  async function resubscribe() {
    'use server';
    await resubscribeByToken(token);
    revalidatePath('/unsubscribe');
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-primary">{t.title}</h1>

      {!state.found ? (
        <p className="mt-4 text-foreground/80">{t.invalid}</p>
      ) : state.unsubscribed ? (
        <>
          <p className="mt-6 text-lg font-semibold text-foreground">{t.doneHeading}</p>
          <p className="mt-2 text-foreground/80">{t.doneBody}</p>
          <form action={resubscribe} className="mt-6">
            <button
              type="submit"
              className="rounded-xl bg-accent px-6 py-3 font-semibold text-white touch-manipulation transition-colors hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t.resubscribeBtn}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-6 text-lg font-semibold text-foreground">{t.subscribedHeading}</p>
          <p className="mt-2 text-foreground/80">{t.subscribedBody}</p>
          <form action={unsubscribe} className="mt-6">
            <button
              type="submit"
              className="rounded-xl bg-primary px-6 py-3 font-semibold text-white touch-manipulation transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.unsubscribeBtn}
            </button>
          </form>
        </>
      )}

      <p className="mt-10 max-w-xs text-xs text-foreground/60">{t.note}</p>
    </main>
  );
}
