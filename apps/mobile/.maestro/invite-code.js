// Puts one of INVITER's unused personal invite codes in output.inviteCode, and their link id in output.inviteLink
// (INV-03). Signs INVITER in against local Supabase with an email code from Mailpit, then calls my_invites().
// Needs ANON_KEY, local Supabase's anon key, passed at run time (never committed):
//   maestro test -e ANON_KEY=$(npx supabase status -o json | jq -r .ANON_KEY) apps/mobile/.maestro/invite-waiting.yaml
// Used by invite-waiting.yaml and invite-link.yaml. Maestro's JavaScript provides json, http and output.
/* global json, http, output, INVITER, ANON_KEY */
const api = 'http://127.0.0.1:55421';
const mail = 'http://127.0.0.1:55424';
if (!ANON_KEY) throw new Error('pass -e ANON_KEY=… (npx supabase status)');
const headers = { apikey: ANON_KEY, 'Content-Type': 'application/json' };
http.request(mail + '/api/v1/messages', { method: 'DELETE' });
http.post(api + '/auth/v1/otp', {
  headers: headers,
  body: JSON.stringify({ email: INVITER, create_user: false }),
});
let code = null;
for (let i = 0; i < 40 && !code; i++) {
  const list = json(http.get(mail + '/api/v1/search?query=to:' + INVITER).body);
  if (list.messages && list.messages.length > 0) {
    const message = json(http.get(mail + '/api/v1/message/' + list.messages[0].ID).body);
    const match = (message.Subject || '').match(/^(\d{6})\b/);
    if (match) code = match[1];
  }
}
if (!code) throw new Error('no sign-in email for ' + INVITER);
const session = json(
  http.post(api + '/auth/v1/verify', {
    headers: headers,
    body: JSON.stringify({ type: 'email', email: INVITER, token: code }),
  }).body,
);
if (!session.access_token) throw new Error('could not sign ' + INVITER + ' in');
const invites = json(
  http.post(api + '/rest/v1/rpc/my_invites', {
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
    body: '{}',
  }).body,
);
const unused = (invites.codes || []).filter((c) => !c.used);
if (unused.length === 0) throw new Error(INVITER + ' has no unused invite codes');
output.inviteCode = unused[0].code;
output.inviteLink = invites.link ? invites.link.id : null;
