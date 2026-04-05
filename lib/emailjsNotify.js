/**
 * Notificação opcional após RSVP (EmailJS REST API a partir do servidor Node).
 *
 * Painel EmailJS:
 * - Security: permitir API fora do browser
 *   https://dashboard.emailjs.com/admin/account/security
 * - API keys: Public Key → user_id; Private Key → accessToken no JSON (modo strict)
 *   https://dashboard.emailjs.com/admin/account
 *
 * Variáveis: EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY, EMAILJS_SERVICE_ID,
 * EMAILJS_TEMPLATE_ID — sem as quatro, o envio é ignorado (RSVP continua OK).
 */

async function notifyRsvpEmailJs({ name, email }) {
  const userId = (process.env.EMAILJS_PUBLIC_KEY || "").trim();
  const privateKey = (process.env.EMAILJS_PRIVATE_KEY || "").trim();
  const serviceId = (process.env.EMAILJS_SERVICE_ID || "").trim();
  const templateId = (process.env.EMAILJS_TEMPLATE_ID || "").trim();
  if (!userId || !serviceId || !templateId) return;
  if (!privateKey) {
    console.warn(
      "[emailjs] Defina EMAILJS_PRIVATE_KEY no .env (EmailJS → Account → API keys → Private key). Obrigatório para envio pelo servidor em modo strict."
    );
    return;
  }

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: userId,
      accessToken: privateKey,
      template_params: {
        name,
        email,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`EmailJS HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
}

module.exports = { notifyRsvpEmailJs };
