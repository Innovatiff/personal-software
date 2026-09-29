// ============================================
// One-tap payment reminders: a prewritten Innovatif message you can
// send by email, WhatsApp, the share sheet, or copy.
// ============================================
import { icon } from './icons.js';
import { toast } from './toast.js';
import { haptic } from './anim.js';
import { reminderMessage } from './coach.js';

/**
 * @param {object} o
 * @param {string}  o.clientName
 * @param {number}  o.amount
 * @param {string|Date} [o.dueDate]
 * @param {string}  [o.number]     invoice number
 * @param {string}  [o.service]
 * @param {string}  [o.email]      client email (prefills the recipient)
 * @param {string}  [o.phone]      client phone (prefills WhatsApp)
 * @param {string}  [o.issuer]     your name
 * @param {(channel:string)=>void} [o.onSent]
 */
export function openReminder(o = {}) {
  const msg = reminderMessage(o);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const digits = String(o.phone || '').replace(/[^\d]/g, '');
  overlay.innerHTML = `
    <div class="modal rem-modal">
      <div class="modal-title" style="display:flex;align-items:center;gap:9px">${icon('bell', 18)} Send a reminder</div>
      <div class="modal-desc" style="margin-bottom:14px">To <b>${escHtml(o.clientName || 'client')}</b>${o.email ? ` · ${escHtml(o.email)}` : ''}${o.phone ? ` · ${escHtml(o.phone)}` : ''}</div>
      <textarea class="form-control rem-body" id="rem-body" rows="9">${escHtml(msg.body)}</textarea>
      <div class="rem-channels">
        <button class="rem-ch" id="rem-email">${icon('mail', 18)}<span>Email</span><small>${o.email ? 'To ' + escHtml(o.email) : 'Pick recipient'}</small></button>
        <button class="rem-ch" id="rem-wa">${icon('messageCircle', 18)}<span>WhatsApp</span><small>${digits ? 'To ' + escHtml(o.phone) : 'Pick a chat'}</small></button>
        <button class="rem-ch" id="rem-copy">${icon('copy', 18)}<span>Copy</span><small>Paste anywhere</small></button>
        ${navigator.share ? `<button class="rem-ch" id="rem-share">${icon('share', 18)}<span>Share</span><small>Other apps</small></button>` : ''}
      </div>
      ${!o.email && !digits ? `<div class="form-hint" style="margin-top:12px">Add an email or phone on the client's profile to prefill the recipient.</div>` : ''}
      <div class="modal-actions" style="margin-top:16px">
        <button class="btn btn-secondary" id="rem-cancel">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const body = () => overlay.querySelector('#rem-body').value;
  const close = () => overlay.remove();
  const sent = (channel) => {
    haptic(10);
    toast(`Reminder ready in ${channel}`, 'success');
    close();
    o.onSent?.(channel);
  };

  overlay.querySelector('#rem-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#rem-email').addEventListener('click', () => {
    const url = `mailto:${encodeURIComponent(o.email || '')}?subject=${encodeURIComponent(msg.subject)}&body=${encodeURIComponent(body())}`;
    window.location.href = url;
    sent('Email');
  });
  overlay.querySelector('#rem-wa').addEventListener('click', () => {
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(body())}`;
    window.open(url, '_blank', 'noopener');
    sent('WhatsApp');
  });
  overlay.querySelector('#rem-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(body()); sent('clipboard'); }
    catch { toast('Could not copy — select the text and copy it manually', 'error'); }
  });
  overlay.querySelector('#rem-share')?.addEventListener('click', async () => {
    try { await navigator.share({ title: msg.subject, text: body() }); sent('share sheet'); }
    catch (err) { if (err?.name !== 'AbortError') toast('Could not open the share sheet', 'error'); }
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
