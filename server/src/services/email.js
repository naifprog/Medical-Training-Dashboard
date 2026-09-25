// Minimal email abstraction. Swap the body of sendMail() for a real
// provider (SMTP via nodemailer, or a transactional API) once credentials
// exist -- read them from environment variables, never hardcode secrets.
//
// SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM are the
// expected future env vars. None are configured in this environment, so
// this currently always falls back to the dev-only console adapter, which
// is intentionally never used when NODE_ENV=production (see below).

const hasSmtpConfigured = !!process.env.SMTP_HOST;

export async function sendMail({ to, subject, html, devUrl }) {
  if (hasSmtpConfigured) {
    // TODO(Phase 8 follow-up, requires real credentials): send via SMTP_HOST/PORT/USER/PASS.
    throw new Error("SMTP is configured but not yet implemented -- no provider is wired up.");
  }

  if (process.env.NODE_ENV === "production") {
    // Never leak a token link to logs/console in production if no real
    // provider is configured -- fail loudly instead of pretending to send.
    console.error(`[email] No SMTP provider configured; cannot deliver "${subject}" to ${to} in production.`);
    throw new Error("Email delivery is not configured.");
  }

  console.log(`\n[dev-mail] To: ${to}\n[dev-mail] Subject: ${subject}\n[dev-mail] Link: ${devUrl}\n`);
  return { delivered: false, dev: true };
}

export function isEmailConfigured() {
  return hasSmtpConfigured;
}
