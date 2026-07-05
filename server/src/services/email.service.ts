import { Resend } from "resend";
import { env } from "../config/environment.js";
import { logger } from "../utils/logger.js";
import type { ReactElement } from "react";

/**
 * Email Service — Sends transactional emails via Resend.
 *
 * Gracefully degrades when RESEND_API_KEY is not configured.
 * All calls are non-blocking and log failures without crashing.
 */

let resend: Resend | null = null;

/**
 * Lazily initialise the Resend SDK.
 * Returns null when no API key is configured.
 */
function getResend(): Resend | null {
  if (resend) return resend;
  if (!env.RESEND_API_KEY) {
    return null;
  }
  resend = new Resend(env.RESEND_API_KEY);
  return resend;
}

/**
 * Check whether the email subsystem is configured.
 */
export function isEmailConfigured(): boolean {
  return !!env.RESEND_API_KEY;
}

/**
 * Send an email using a React Email component.
 *
 * @param to       — Recipient email address
 * @param subject  — Email subject line
 * @param react    — A React Email JSX element (rendered server-side)
 */
export async function sendEmail(
  to: string,
  subject: string,
  react: ReactElement
): Promise<boolean> {
  const client = getResend();

  if (!client) {
    logger.warn(
      { to, subject },
      "Email skipped — RESEND_API_KEY not configured"
    );
    return false;
  }

  try {
    const { error } = await client.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      react,
    });

    if (error) {
      logger.error({ to, subject, error }, "Resend API returned an error");
      return false;
    }

    logger.info({ to, subject }, "Email sent successfully");
    return true;
  } catch (err) {
    logger.error(
      { to, subject, err: err instanceof Error ? err.message : "Unknown" },
      "Failed to send email"
    );
    return false;
  }
}
