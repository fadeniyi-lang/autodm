// Transactional email (password resets). The provider is chosen by env:
//   - EMAIL_SERVER set: send over your own SMTP server with nodemailer, e.g.
//     smtps://user%40example.com:password@mail.example.com:465
//   - otherwise RESEND_API_KEY set: send through Resend's HTTP API.
//   - neither set: log instead of sending, so local dev and a fresh deploy
//     never have to configure email just to exercise the auth flows.
// EMAIL_FROM is the sender for both, e.g. "AutoDM <login@example.com>".
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const from = process.env.EMAIL_FROM || "AutoDM <no-reply@example.com>";
  const smtpUrl = process.env.EMAIL_SERVER;
  const apiKey = process.env.RESEND_API_KEY;

  if (smtpUrl) {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(smtpUrl);
    await transport.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return;
  }

  if (!apiKey) {
    console.warn(
      `[email] Neither EMAIL_SERVER nor RESEND_API_KEY is set, skipping send to ${opts.to}: ${opts.subject}`
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }
}
