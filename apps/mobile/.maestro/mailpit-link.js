// Reads the newest sign-in email for EMAIL from local Mailpit (forwarded to the Mac on 55424) and puts its
// link in output.link. Used by sign-in-email.yaml. Maestro's JavaScript provides json, http and output.
/* global json, http, output, EMAIL */
let found = null;
for (let i = 0; i < 20 && !found; i++) {
  const list = json(http.get('http://127.0.0.1:55424/api/v1/search?query=to:' + EMAIL).body);
  if (list.messages && list.messages.length > 0) found = list.messages[0].ID;
}
if (!found) throw new Error('no email for ' + EMAIL + ' in Mailpit');
const text = json(http.get('http://127.0.0.1:55424/api/v1/message/' + found).body).Text;
output.link = text.match(/https?:\/\/\S+verify\?\S+/)[0];
