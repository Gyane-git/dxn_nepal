import { prisma } from "@/lib/prisma";

/**
 * Records an in-app notification for a user and logs it as a stand-in for a
 * real email/SMS provider. Swap the console.log below for a provider call
 * (e.g. Resend, Twilio) when credentials are available — call sites don't change.
 */
export async function notify(
  userId: number,
  message: string,
  options?: { type?: string; link?: string }
) {
  const [notification] = await Promise.all([
    prisma.notification.create({
      data: { userId, message, type: options?.type ?? null, link: options?.link ?? null },
    }),
    Promise.resolve(console.log(`[notify] user=${userId}: ${message}`)),
  ]);
  return notification;
}
