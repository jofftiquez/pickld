// Reads the newest sign-in email for EMAIL from local Mailpit (forwarded to the Mac on 55424) and puts its
// 6-digit code in output.code (D-60). The code-only emails put it in the subject ("123456 is your Pickld
// code"); otherwise the first 6-digit number in the text. Used by sign-in-email.yaml, onboarding-full.yaml and
// about-under13.yaml. Maestro's JavaScript provides json, http and output.
/* global json, http, output, EMAIL */
let found = null;
for (let i = 0; i < 20 && !found; i++) {
  const list = json(http.get('http://127.0.0.1:55424/api/v1/search?query=to:' + EMAIL).body);
  if (list.messages && list.messages.length > 0) found = list.messages[0].ID;
}
if (!found) throw new Error('no email for ' + EMAIL + ' in Mailpit');
const message = json(http.get('http://127.0.0.1:55424/api/v1/message/' + found).body);
const match = (message.Subject || '').match(/^(\d{6})\b/) || (message.Text || '').match(/\b(\d{6})\b/);
if (!match) throw new Error('no 6-digit code in the email for ' + EMAIL);
output.code = match[1];
