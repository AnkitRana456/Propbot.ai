/* global process, console, fetch */
// Sends a fake Instagram or Messenger DM to your local API, signed the way Meta signs it, so it shows up in the Inbox.
//
// Usage (API must be running):
//   node apps/api/scripts/simulate-social-dm.mjs --account 1784140000000001 --secret dummy_app_secret_123 --text "Is the 3 BHK still available?"
// Options:
//   --account  the "Page / account ID" you typed when connecting the channel (required)
//   --secret   the "App secret" you typed for that connection (required)
//   --channel  instagram (default) or messenger
//   --sender   a fake sender id (default 5550001)
//   --text     the message
//   --api      API address (default http://localhost:3000)
import crypto from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const { account, secret } = args;
if (!account || !secret) {
  console.error('Missing --account or --secret. See the usage notes at the top of this file.');
  process.exit(1);
}
const channel = args.channel === 'messenger' ? 'messenger' : 'instagram';
const api = (args.api || 'http://localhost:3000').replace(/\/+$/, '');

const payload = {
  object: channel === 'instagram' ? 'instagram' : 'page',
  entry: [
    {
      id: account,
      messaging: [
        {
          sender: { id: args.sender || '5550001' },
          recipient: { id: account },
          timestamp: Date.now(),
          message: { mid: `mid.${crypto.randomUUID()}`, text: args.text || 'Hi, is the 3 BHK in Whitefield still available?' },
        },
      ],
    },
  ],
};

const raw = JSON.stringify(payload);
const signature = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
const res = await fetch(`${api}/api/public/omni/webhooks/meta-social`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
  body: raw,
});
const body = await res.json().catch(() => ({}));
console.log(res.status, JSON.stringify(body));
if (res.ok && body?.data?.stored > 0) console.log('Stored. Open Inbox in the app and look for the new conversation.');
else if (res.ok) console.log('Nothing stored: the account id does not match a connected channel, or the company has no chatbot yet.');
else console.log('Not accepted. A 401 means the secret does not match the one saved on the connection.');
