// Signs a page in through the real two-step form (D-60): the email, then the 6-digit code. The code comes
// from auth.admin.generateLink (properties.email_otp) instead of the inbox; it's made after the form sends
// its email, because each new code replaces the one before.
export async function signInWithCode(page, { base, admin, email }) {
  await page.goto(`${base}/sign-in`);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  const field = page.getByLabel('Enter the 6-digit code');
  await field.waitFor();
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  await field.fill(data.properties.email_otp);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(`${base}/`);
  return page;
}
