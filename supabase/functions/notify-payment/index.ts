/**
 * notify-payment — Supabase Edge Function
 *
 * Triggered by a Database Webhook on INSERT to contribution_payments.
 * Sends two possible emails via Resend:
 *   1. Payment confirmation  — always sent when a payment is recorded
 *   2. Full-payment congratulations — sent only when balance reaches 0
 *
 * Required Supabase Edge Function secrets (set in dashboard):
 *   RESEND_API_KEY  — your Resend API key  (re_xxxxxxxx)
 *   FROM_EMAIL      — verified sender address (e.g. reunion@yourdomain.com)
 *   SUPABASE_URL    — auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types ──────────────────────────────────────────────────────────────────
interface PaymentRow {
  id: string;
  classmate_id: string;
  amount: number;
  payment_method: string;
  transaction_reference: string | null;
  payment_date: string;
  recorded_by: string | null;
  notes: string | null;
  created_at: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: PaymentRow;
  schema: string;
  old_record: PaymentRow | null;
}

interface ClassmateRow {
  full_name: string;
  email: string | null;
  phone: string;
  class_id: string;
}

interface ContributionRow {
  expected_amount: number;
  amount_paid: number;
  payment_status: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return `GH₵${Number(amount).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ── Email templates ────────────────────────────────────────────────────────

function paymentConfirmationHtml(
  firstName: string,
  fullName: string,
  classId: string,
  amount: number,
  method: string,
  paymentDate: string,
  reference: string | null,
  totalPaid: number,
  balance: number,
  expected: number,
  recordedBy: string | null
): string {
  const progressPct = Math.min(Math.round((totalPaid / expected) * 100), 100);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payment Received</title>
</head>
<body style="margin:0;padding:0;background:#f7f3eb;font-family:'Helvetica Neue',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3eb;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:white;border-radius:16px;
                    overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#171717;padding:32px 40px;text-align:center;">
            <p style="margin:0;color:#b58a3a;font-size:11px;font-weight:800;
                      letter-spacing:3px;">3A12 • CLASS OF 2021</p>
            <h1 style="margin:10px 0 0;color:white;font-size:26px;font-weight:700;">
              Payment Received ✓
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">

            <p style="margin:0 0 20px;color:#333;font-size:15px;line-height:1.6;">
              Hi <strong>${firstName}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#555;font-size:14px;line-height:1.7;">
              We've recorded a reunion contribution payment on your behalf.
              Here are the details:
            </p>

            <!-- Payment detail box -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f8f4eb;border-radius:12px;
                          border:1px solid #e8d9b3;margin-bottom:28px;">
              <tr>
                <td style="padding:24px 28px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:12px;
                                 font-weight:700;text-transform:uppercase;
                                 letter-spacing:0.05em;width:45%;">Amount Paid</td>
                      <td style="padding:6px 0;color:#171717;font-size:15px;
                                 font-weight:800;">${formatCurrency(amount)}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:12px;
                                 font-weight:700;text-transform:uppercase;
                                 letter-spacing:0.05em;">Payment Method</td>
                      <td style="padding:6px 0;color:#444;font-size:14px;">
                        ${method}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:12px;
                                 font-weight:700;text-transform:uppercase;
                                 letter-spacing:0.05em;">Payment Date</td>
                      <td style="padding:6px 0;color:#444;font-size:14px;">
                        ${formatDate(paymentDate)}
                      </td>
                    </tr>
                    ${reference ? `
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:12px;
                                 font-weight:700;text-transform:uppercase;
                                 letter-spacing:0.05em;">Reference</td>
                      <td style="padding:6px 0;color:#444;font-size:14px;
                                 font-family:monospace;">${reference}</td>
                    </tr>` : ""}
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:12px;
                                 font-weight:700;text-transform:uppercase;
                                 letter-spacing:0.05em;">Recorded By</td>
                      <td style="padding:6px 0;color:#444;font-size:14px;">
                        ${recordedBy || "Reunion Admin"}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Balance summary -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="margin-bottom:28px;">
              <tr>
                <td width="33%" style="text-align:center;padding:16px 8px;
                    background:#ecfdf3;border-radius:10px;margin-right:8px;">
                  <p style="margin:0;color:#888;font-size:11px;font-weight:700;
                             text-transform:uppercase;">Total Paid</p>
                  <p style="margin:6px 0 0;color:#198754;font-size:18px;
                             font-weight:800;">${formatCurrency(totalPaid)}</p>
                </td>
                <td width="4%"></td>
                <td width="33%" style="text-align:center;padding:16px 8px;
                    background:${balance > 0 ? "#fff5f5" : "#ecfdf3"};
                    border-radius:10px;">
                  <p style="margin:0;color:#888;font-size:11px;font-weight:700;
                             text-transform:uppercase;">Balance</p>
                  <p style="margin:6px 0 0;color:${balance > 0 ? "#b42318" : "#198754"};
                             font-size:18px;font-weight:800;">${formatCurrency(balance)}</p>
                </td>
                <td width="4%"></td>
                <td width="33%" style="text-align:center;padding:16px 8px;
                    background:#f8f4eb;border-radius:10px;">
                  <p style="margin:0;color:#888;font-size:11px;font-weight:700;
                             text-transform:uppercase;">Expected</p>
                  <p style="margin:6px 0 0;color:#171717;font-size:18px;
                             font-weight:800;">${formatCurrency(expected)}</p>
                </td>
              </tr>
            </table>

            <!-- Progress bar -->
            <p style="margin:0 0 6px;color:#555;font-size:13px;">
              <strong>${progressPct}%</strong> of your contribution paid
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#e2d9c8;border-radius:99px;height:8px;
                          margin-bottom:28px;overflow:hidden;">
              <tr>
                <td width="${progressPct}%"
                    style="background:linear-gradient(90deg,#b58a3a,#d4a84b);
                           height:8px;border-radius:99px;"></td>
                <td></td>
              </tr>
            </table>

            <!-- Classmate ID -->
            <p style="margin:0 0 6px;color:#888;font-size:12px;font-weight:700;
                       text-transform:uppercase;letter-spacing:0.05em;">
              Your Classmate ID
            </p>
            <p style="margin:0 0 28px;font-family:monospace;font-size:16px;
                       font-weight:800;color:#b58a3a;letter-spacing:0.08em;">
              ${classId}
            </p>

            <p style="margin:0;color:#888;font-size:13px;line-height:1.6;">
              If you believe this payment was recorded in error, please
              contact the reunion committee immediately.
            </p>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f6f1;padding:20px 40px;text-align:center;
                     border-top:1px solid #eee;">
            <p style="margin:0;color:#aaa;font-size:11px;line-height:1.6;">
              3A12 Class of 2021 Reunion &nbsp;•&nbsp;
              Different Paths • One Beginning • One Family
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}

function fullPaymentHtml(firstName: string, fullName: string, classId: string, expected: number): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Contribution Complete</title>
</head>
<body style="margin:0;padding:0;background:#f7f3eb;font-family:'Helvetica Neue',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3eb;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:white;border-radius:16px;
                    overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">

        <!-- Header — gold celebration -->
        <tr>
          <td style="background:linear-gradient(135deg,#b58a3a,#d4a84b);
                     padding:40px;text-align:center;">
            <p style="margin:0;font-size:48px;">🎉</p>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:11px;
                      font-weight:800;letter-spacing:3px;">3A12 • CLASS OF 2021</p>
            <h1 style="margin:10px 0 0;color:white;font-size:28px;font-weight:800;">
              You're Fully Paid Up!
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 20px;color:#333;font-size:16px;line-height:1.6;">
              Hi <strong>${firstName}</strong>,
            </p>
            <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.8;">
              Fantastic news! You have completed your full reunion contribution
              of <strong>${formatCurrency(expected)}</strong>.
              Thank you — your support makes this reunion possible for everyone.
            </p>

            <!-- Confirmation box -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f8f4eb;border:2px solid #b58a3a;
                          border-radius:14px;margin-bottom:28px;">
              <tr>
                <td style="padding:24px;text-align:center;">
                  <p style="margin:0;color:#888;font-size:11px;font-weight:700;
                             text-transform:uppercase;letter-spacing:0.1em;">
                    Total Contribution
                  </p>
                  <p style="margin:8px 0;color:#b58a3a;font-size:36px;
                             font-weight:800;">${formatCurrency(expected)}</p>
                  <p style="margin:0;color:#198754;font-size:13px;font-weight:800;">
                    ✓ FULLY PAID
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#888;font-size:12px;font-weight:700;
                       text-transform:uppercase;letter-spacing:0.05em;">
              Your Classmate ID
            </p>
            <p style="margin:0 0 28px;font-family:monospace;font-size:16px;
                       font-weight:800;color:#b58a3a;letter-spacing:0.08em;">
              ${classId}
            </p>

            <p style="margin:0;color:#555;font-size:14px;line-height:1.8;">
              We look forward to seeing you at the reunion. Keep your
              Classmate ID handy — you'll need it for check-in on the day.
            </p>

            <!-- Divider -->
            <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />

            <p style="margin:0;color:#888;font-size:13px;line-height:1.6;
                       font-style:italic;">
              "Different Paths • One Beginning • One Family"
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f6f1;padding:20px 40px;text-align:center;
                     border-top:1px solid #eee;">
            <p style="margin:0;color:#aaa;font-size:11px;line-height:1.6;">
              3A12 Class of 2021 Reunion Committee
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}

// ── Resend email sender ────────────────────────────────────────────────────
async function sendEmail(
  resendKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Read secrets
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM_EMAIL     = Deno.env.get("FROM_EMAIL");
  const SUPABASE_URL   = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!RESEND_API_KEY || !FROM_EMAIL || !SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing required environment variables");
    return new Response("Server misconfiguration", { status: 500 });
  }

  // Parse webhook payload
  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  // Only handle INSERT on contribution_payments
  if (payload.type !== "INSERT" || payload.table !== "contribution_payments") {
    return new Response("Ignored", { status: 200 });
  }

  const payment = payload.record;

  // Use service role client so we can read private data server-side
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Fetch classmate ──────────────────────────────────────────────────────
  const { data: classmate, error: cmErr } = await supabase
    .from("classmates")
    .select("full_name, email, phone, class_id")
    .eq("id", payment.classmate_id)
    .single<ClassmateRow>();

  if (cmErr || !classmate) {
    console.error("Could not fetch classmate:", cmErr?.message);
    return new Response("Classmate not found", { status: 404 });
  }

  // No email address on file — nothing to send
  if (!classmate.email) {
    console.log(`No email for classmate ${classmate.class_id} — skipping notification`);
    return new Response("No email on file", { status: 200 });
  }

  // ── Fetch contribution summary ───────────────────────────────────────────
  const { data: contrib, error: contribErr } = await supabase
    .from("contributions")
    .select("expected_amount, amount_paid, payment_status")
    .eq("classmate_id", payment.classmate_id)
    .single<ContributionRow>();

  if (contribErr || !contrib) {
    console.error("Could not fetch contribution summary:", contribErr?.message);
    return new Response("Contribution not found", { status: 404 });
  }

  const firstName  = classmate.full_name.trim().split(" ")[0];
  const totalPaid  = Number(contrib.amount_paid);
  const expected   = Number(contrib.expected_amount);
  const balance    = Math.max(expected - totalPaid, 0);
  const isFullyPaid = contrib.payment_status === "PAID" || balance === 0;

  // ── Send payment confirmation email ─────────────────────────────────────
  try {
    await sendEmail(
      RESEND_API_KEY,
      FROM_EMAIL,
      classmate.email,
      `Payment of ${formatCurrency(Number(payment.amount))} received — 3A12 Reunion`,
      paymentConfirmationHtml(
        firstName,
        classmate.full_name,
        classmate.class_id,
        Number(payment.amount),
        payment.payment_method,
        payment.payment_date,
        payment.transaction_reference,
        totalPaid,
        balance,
        expected,
        payment.recorded_by
      )
    );
    console.log(`Payment confirmation sent to ${classmate.email}`);
  } catch (err) {
    console.error("Failed to send payment confirmation:", err);
    // Don't return error — still try the full-payment email below
  }

  // ── Send full-payment congratulations email (if applicable) ─────────────
  if (isFullyPaid) {
    try {
      await sendEmail(
        RESEND_API_KEY,
        FROM_EMAIL,
        classmate.email,
        `🎉 You're fully paid up! — 3A12 Reunion`,
        fullPaymentHtml(
          firstName,
          classmate.full_name,
          classmate.class_id,
          expected
        )
      );
      console.log(`Full-payment congratulations sent to ${classmate.email}`);
    } catch (err) {
      console.error("Failed to send full-payment email:", err);
    }
  }

  return new Response(JSON.stringify({ ok: true, isFullyPaid }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
