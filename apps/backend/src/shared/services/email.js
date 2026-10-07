const { config } = require('../../config/environment');

function emailError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

function safeTechnicalCode(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(value) ? value : undefined;
}

function safeProviderMessage(value, apiKey) {
  if (typeof value !== 'string') return undefined;
  let message = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 500);
  if (nonempty(apiKey)) message = message.split(apiKey).join('[redacted]');
  return (
    message
      .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
      .replace(/\b(?:re|rk|sk)_[a-zA-Z0-9_-]{8,}\b/g, '[redacted]')
      .replace(/https?:\/\/[^\s"'<>]+/gi, '[redacted-url]')
      .replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '[redacted-email]')
      .replace(/\b[a-f0-9]{32,}\b/gi, '[redacted-token]')
      .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, '[redacted-token]')
      .replace(/("?(?:password|token|secret|authorization)"?\s*[:=]\s*"?)[^\s,;"}]+/gi, '$1[redacted]')
      .trim()
      .slice(0, 240) || undefined
  );
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function buildBrandEmailTemplate({
  title,
  heading,
  intro,
  primaryActionLabel,
  primaryActionUrl,
  secondaryText,
  footerText = '© YJ Nexo ERP',
}) {
  const safeTitle = escapeHtml(title || 'YJ Nexo ERP');
  const safeHeading = escapeHtml(heading || 'Actualización importante');
  const safeIntro = escapeHtml(intro || 'Hay una actualización importante para tu cuenta.');
  const safeSecondary = escapeHtml(secondaryText || 'Si necesitas ayuda, contacta con tu administrador.');
  const safeFooter = escapeHtml(footerText);
  const safePrimaryActionLabel = escapeHtml(primaryActionLabel || 'Acceder');
  const safePrimaryActionUrl = escapeHtml(primaryActionUrl || '#');

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;background:#e2e8f0;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e2e8f0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dbe3ec;">
            <tr>
              <td style="padding:22px 28px;background:#0f172a;">
                <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">YJ Nexo ERP</div>
                <div style="font-size:11px;color:#cbd5e1;letter-spacing:1.2px;text-transform:uppercase;margin-top:4px;">Operación segura</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 18px;">
                <div style="font-size:12px;font-weight:700;color:#1d4ed8;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">${safeTitle}</div>
                <h1 style="margin:0 0 12px;font-size:28px;line-height:1.25;color:#0f172a;">${safeHeading}</h1>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#334155;">${safeIntro}</p>
                ${primaryActionUrl && primaryActionLabel ? `
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:12px 0 22px;">
                    <tr>
                      <td style="background:#1d4ed8;border-radius:10px;">
                        <a href="${safePrimaryActionUrl}" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${safePrimaryActionLabel}</a>
                      </td>
                    </tr>
                  </table>
                ` : ''}
                <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">${safeSecondary}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                  <tr>
                    <td style="padding:16px 18px;font-size:13px;line-height:1.7;color:#475569;">
                      ${safeFooter}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function readProviderError(response, apiKey) {
  let body = '';
  try {
    if (typeof response.text === 'function') body = await response.text();
    else if (typeof response.json === 'function') body = JSON.stringify(await response.json());
  } catch (_) {
    // Status remains useful even if the provider body is unavailable or malformed.
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (_) {
    parsed = undefined;
  }
  const providerCode = safeTechnicalCode(parsed?.name || parsed?.code || parsed?.type);
  const providerMessage = safeProviderMessage(
    typeof parsed?.message === 'string' ? parsed.message : body,
    apiKey,
  );
  return { providerCode, providerMessage };
}

// Server-only transport. Acceptance by Resend is not confirmation of delivery.
async function sendEmail({ to, subject, text, html } = {}) {
  if (!nonempty(config.resendApiKey) || !nonempty(config.emailFrom)) {
    throw emailError('EMAIL_NOT_CONFIGURED', 'Configure RESEND_API_KEY y EMAIL_FROM', {
      stage: 'email_configuration',
    });
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
    throw emailError('EMAIL_INVALID_MESSAGE', 'Destinatario, asunto y contenido requeridos', {
      stage: 'email_configuration',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let stage = 'resend_request';
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
    stage = 'resend_response';
    if (!response.ok) {
      const { providerCode, providerMessage } = await readProviderError(
        response,
        config.resendApiKey,
      );
      const httpStatus = Number.isInteger(response.status) ? response.status : undefined;
      const statusText = httpStatus ? `HTTP ${httpStatus}` : 'HTTP no disponible';
      const detail = providerMessage ? `: ${providerMessage}` : '';
      throw emailError('EMAIL_PROVIDER_ERROR', `Resend respondió ${statusText}${detail}`, {
        stage: 'resend_response',
        httpStatus,
        status: httpStatus,
        providerCode,
        providerMessage,
      });
    }
    let data;
    try {
      data = await response.json();
    } catch (_) {
      throw emailError('EMAIL_PROVIDER_ERROR', 'Respuesta de Resend inválida', {
        stage: 'resend_response',
        httpStatus: response.status,
        status: response.status,
      });
    }
    if (!nonempty(data?.id)) {
      throw emailError('EMAIL_PROVIDER_ERROR', 'Respuesta de Resend inválida', {
        stage: 'resend_response',
        httpStatus: response.status,
        status: response.status,
      });
    }
    return { id: data.id };
  } catch (error) {
    if (error?.code === 'EMAIL_PROVIDER_ERROR') throw error;
    if (controller.signal.aborted) {
      throw emailError('EMAIL_TIMEOUT', 'Tiempo de espera de Resend agotado', {
        stage: 'resend_timeout',
      });
    }
    throw emailError('EMAIL_SEND_FAILED', 'No se pudo completar el envío con Resend', {
      stage,
    });
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { sendEmail, buildBrandEmailTemplate };
