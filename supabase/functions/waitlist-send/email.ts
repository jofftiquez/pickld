// The waitlist invite email (INV-09), in the style of the sign-in code email (supabase/templates/magic_link.html).
// One person, one code, one link: pickld.me/i/<code> opens the invite in the app, or shows the code and the
// store buttons on the web. Codes use only A–Z and 2–9, so nothing here needs escaping.

export interface InviteEmail {
  subject: string;
  html: string;
  text: string;
}

/** "Nov 29, 2026" in Manila time, where the founders and most of the waitlist are. */
export function endDay(expiresAt: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(new Date(expiresAt));
}

export function inviteEmail(code: string, expiresAt: string, site: string): InviteEmail {
  const link = `${site}/i/${code}`;
  const until = endDay(expiresAt);
  const subject = 'Your Pickld invite is here';
  const text = [
    'You’re in',
    '',
    'Thanks for joining the Pickld waitlist. Here’s your invite code:',
    '',
    code,
    '',
    `Open your invite: ${link}`,
    '',
    `Get Pickld, sign up with any email, and enter the code. It works once, until ${until}.`,
    '',
    'You’re getting this because you joined the waitlist at pickld.me. Reply if you’d rather not hear from us.',
    '',
    'Pickld · Eight moments. One real day.',
  ].join('\n');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${subject}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&amp;display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background:#f4f5f0;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">Your invite code ${code} works once, until ${until}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f5f0" style="background:#f4f5f0;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px; font-family:'Plus Jakarta Sans', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#11140d;">
<tr><td align="center" style="padding:0 0 20px; font-size:28px; font-weight:800; letter-spacing:-0.84px; color:#7fad33;">Pickld</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff; border-radius:24px; padding:36px 28px; text-align:center;">
<h1 style="margin:0 0 10px; font-size:26px; line-height:1.2; font-weight:800; letter-spacing:-0.78px; color:#11140d;">You’re in</h1>
<p style="margin:0 0 24px; font-size:15px; line-height:1.5; font-weight:500; color:#3c4336;">Thanks for joining the Pickld waitlist. Here’s your invite code.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
<td bgcolor="#e6f1d3" style="background:#e6f1d3; border-radius:16px; padding:16px 16px 16px 24px; font-size:36px; line-height:1; font-weight:800; letter-spacing:8px; color:#2c470a;">${code}</td>
</tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 0;"><tr>
<td bgcolor="#7fad33" style="background:#7fad33; border-radius:999px;"><a href="${link}" style="display:inline-block; padding:14px 28px; font-size:16px; font-weight:800; color:#ffffff; text-decoration:none;">Open your invite</a></td>
</tr></table>
<p style="margin:16px 0 0; font-size:13px; line-height:1.5; font-weight:500; color:#565e50;">Get Pickld, sign up with any email, and enter the code. It works once, until ${until}.</p>
</td></tr>
<tr><td style="padding:20px 12px 0; text-align:center; font-size:13px; line-height:1.5; font-weight:500; color:#565e50;">You’re getting this because you joined the waitlist at pickld.me. Reply if you’d rather not hear from us.</td></tr>
<tr><td style="padding:12px 12px 0; text-align:center; font-size:12px; line-height:1.5; font-weight:600; color:#565e50;">Pickld · Eight moments. One real day.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject, html, text };
}
