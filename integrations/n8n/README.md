# n8n — WhatsApp outreach workflows (Phase 6)

n8n is a **transport layer only**. It never decides who to message or what
a lead's status is — the admin app owns all of that. n8n's job is: pull
the queue, send the WhatsApp message, and post back what happened.

Two workflows, importable as-is via n8n → **Import from File**:

| File | Trigger | Does |
| --- | --- | --- |
| `outbound-whatsapp.workflow.json` | Cron (every 30 min, business hours) | Polls the send queue → sends via WhatsApp Cloud API → logs each send back |
| `inbound-whatsapp.workflow.json` | WhatsApp Cloud API webhook | Forwards every inbound message/status event to the admin app |

Both are starter workflows — **open each node after importing** and fill
in the four placeholders below. Treat the JSON as a first draft to wire up
in the n8n editor, not a drop-in black box.

## 1. Prerequisites

- A **WhatsApp Business Cloud API** account (Meta), not a personal
  WhatsApp Web session — the outbound side sends cold outreach, and Meta
  requires an **approved template message** for any message sent outside
  a 24-hour customer-initiated window. This is a hard platform rule, not
  an admin-app limitation:
  - Submit your `whatsapp_pitch_v1` / `whatsapp_followup_day2` /
    `whatsapp_followup_day5` / `whatsapp_followup_day10` bodies as WhatsApp
    message templates in Meta Business Manager and wait for approval
    before wiring the outbound workflow live.
  - Until templates are approved, keep sending manual (the existing
    "Copy wa.me link" flow in Outreach still works) — don't point the
    outbound workflow at unapproved templates; Meta will reject the send
    and can flag the number.
- The admin app's **n8n webhook secret**, generated once in
  **Settings → API Keys → n8n / WhatsApp inbound** and pasted into both
  n8n credentials below. The same secret authenticates all three
  endpoints (inbound message, delivery-status callback, outbound queue,
  and the log-sent callback).
- `ADMIN_BASE_URL` — wherever `apps/admin` is deployed, e.g.
  `https://admin.aivexallp.com`.

## 2. How the signature works

Every request between n8n and the admin app is authenticated with
`X-Webhook-Signature: hex(hmac-sha256(secret, <signed content>))`.

- For **POST** requests (`/api/webhooks/whatsapp-inbound`,
  `/api/automation/log-sent`) the signed content is the **raw JSON body
  string**, byte for byte.
- For the **GET** queue poll (`/api/automation/outreach-queue`) there's no
  body, so the signed content is the **query string** (everything after
  `?`, e.g. `limit=25`).

In each workflow this is a small **Function** node right before the HTTP
Request node:

```js
const crypto = require('crypto');
const secret = $env.N8N_WEBHOOK_SECRET; // set as an n8n credential/env var
const payload = JSON.stringify($json); // or the query string for the GET poll
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
return [{ json: { ...$json, __signature: signature, __payload: payload } }];
```

Then the HTTP Request node reads `{{$json.__signature}}` into the
`X-Webhook-Signature` header and sends `{{$json.__payload}}` as the raw
body (Body Content Type: Raw/Text) so what's signed is exactly what's sent.

## 3. Outbound workflow (`outbound-whatsapp.workflow.json`)

1. **Cron trigger** — runs every 30 minutes. Restrict to quiet hours by
   only enabling the trigger's cron expression for your sending window,
   e.g. `*/30 10-19 * * *` (10am–7pm IST, no late-night pings).
2. **HTTP Request → GET `{{ADMIN_BASE_URL}}/api/automation/outreach-queue?limit=20`**
   — the `limit` query param is your **per-run send cap**; at every-30-min
   over a 9-hour window that's ~18 runs/day, so `limit=20` caps this
   number's daily volume at ~360 sends/day theoretical max. For a real
   per-day cap (not per-run), add a **Function node** that reads/writes
   n8n's static workflow data to count sends since local midnight and
   stops early once you hit your real daily number (WhatsApp Cloud API
   also enforces its own messaging-tier caps on new numbers — check yours
   in Meta Business Manager before raising this).
3. **Split In Batches** (size 1) → for each queued item:
   a. **WhatsApp Cloud API node** (or HTTP Request to
      `graph.facebook.com/v19.0/<phone_number_id>/messages`) sending the
      approved template with `item.text` substituted into the template
      variables.
   b. **HTTP Request → POST `{{ADMIN_BASE_URL}}/api/automation/log-sent`**
      with `{ lead_id, template_key, body, provider_message_id }` from the
      WhatsApp API response, signed per §2.
   c. **Wait node** (a few seconds) between sends — don't fire the whole
      batch in the same second; Cloud API rate-limits and it looks like a
      spam burst to Meta's abuse detection.

## 4. Inbound workflow (`inbound-whatsapp.workflow.json`)

1. **Webhook trigger** — set this URL as your WhatsApp Cloud API webhook
   in Meta Business Manager (Meta requires its own verification handshake
   on this webhook; n8n's Webhook node has a built-in "respond to GET
   verification" option — enable it).
2. **IF node** — branch on whether the incoming payload is a message
   (`entry[0].changes[0].value.messages`) or a status update
   (`entry[0].changes[0].value.statuses`).
3. **Set node** — reshape into the admin app's contract:
   - Message branch: `{ "from": "<wa_id>", "body": "<text.body>", "provider_message_id": "<messages[0].id>" }`
   - Status branch: `{ "event": "status", "provider_message_id": "<statuses[0].id>", "status": "<statuses[0].status>" }`
     (Cloud API statuses are `sent|delivered|read|failed` — same names the
     admin app expects, no remapping needed.)
4. **Function node** — sign the reshaped JSON per §2.
5. **HTTP Request → POST `{{ADMIN_BASE_URL}}/api/webhooks/whatsapp-inbound`**
   with the signed body.

## 5. Follow-up ladder — how it actually stops

The ladder lives entirely in `/api/automation/outreach-queue` (admin app),
not in n8n: pitch → day2 → day5 → day10, each rung gated on the previous
message's age and no reply. A lead falls off the queue automatically the
moment it replies (Phase 4's inbound webhook sets `replied_at`) or you move
it to `interested`/`meeting`/`negotiation`/`won`/`lost` by hand. n8n doesn't
need to track any of this — it just polls and gets an empty list once
there's nothing left to send.

## 6. Testing before going live

Test both directions with `curl` before trusting n8n's HTTP nodes:

```bash
# Outbound queue (GET, query-string signature)
SECRET=... ; QS="limit=5"
SIG=$(echo -n "$QS" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
curl "https://admin.example.com/api/automation/outreach-queue?$QS" -H "X-Webhook-Signature: $SIG"

# Inbound message (POST, body signature)
BODY='{"from":"9876543210","body":"Yes interested"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
curl -X POST https://admin.example.com/api/webhooks/whatsapp-inbound \
  -H "X-Webhook-Signature: $SIG" -H "Content-Type: application/json" -d "$BODY"
```
