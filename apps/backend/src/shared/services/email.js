const { config } = require('../../config/environment');

function emailError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

// Server-only transport. Acceptance by Resend is not confirmation of delivery.
async function sendEmail({ to, subject, text, html } = {}) {
  if (!nonempty(config.resendApiKey) || !nonempty(config.emailFrom)) {
    throw emailError('EMAIL_NOT_CONFIGURED', 'Configure RESEND_API_KEY y EMAIL_FROM');
  }
  const recipients = Array.isArray(to) ? to : [to];
  if (
    !recipients.length ||
    recipients.length > 50 ||
    !recipients.every((value) => nonempty(value) && !/[\r\n]/.test(value)) ||
    !nonempty(subject) ||
    (!nonempty(text) && !nonempty(html)) ||
    (text !== undefined && typeof text !== 'string') ||
    (html !== undefined && typeof html !== 'string')
  ) {
    throw emailError('EMAIL_INVALID_MESSAGE', 'Destinatario, asunto y contenido requeridos');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: config.emailFrom, to: recipients, subject, text, html }),
    });
    if (!response.ok) {
      // Never propagate the provider body: it may contain recipient or message data.
      await response.body?.cancel();
      throw emailError('EMAIL_PROVIDER_ERROR', 'Resend rechazó el envío de correo');
    }
    const data = await response.json();
    if (!nonempty(data?.id)) {
      throw emailError('EMAIL_PROVIDER_ERROR', 'Respuesta de Resend inválida');
    }
    return { id: data.id };
  } catch (error) {
    if (['EMAIL_PROVIDER_ERROR'].includes(error?.code)) throw error;
    if (controller.signal.aborted) {
      throw emailError('EMAIL_TIMEOUT', 'Tiempo de espera de Resend agotado');
    }
    throw emailError('EMAIL_SEND_FAILED', 'No se pudo completar el envío con Resend');
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { sendEmail };
