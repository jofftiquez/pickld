// A fresh address (and username) for each run, so Sign up always creates a new account. Used by
// about-under13.yaml and setup-day.yaml.
/* global output */
const stamp = Date.now();
output.email = 'new' + stamp + '@pickld.test';
output.username = 'new' + (stamp % 1000000000);
