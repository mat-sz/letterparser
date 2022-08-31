import { LetterparserNode, LetterparserContentType } from './parser';

export interface LetterparserAttachment {
  contentType: LetterparserContentType;
  body: string | Uint8Array;
  contentId?: string;
}

export interface LetterparserMail {
  subject?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  date?: Date;
  from?: string;
  attachments?: LetterparserAttachment[];

  /**
   * HTML email data.
   */
  html?: string;

  /**
   * Plaintext email data.
   */
  text?: string;

  /**
   * AMP for Email data.
   * More information: https://amp.dev/documentation/guides-and-tutorials/learn/email-spec/amp-email-structure/
   */
  amp?: string;
}

function extractBody(node: LetterparserNode) {
  const attachments: LetterparserAttachment[] = [];
  let html = '';
  let text = '';
  let amp = '';

  if (
    node.body instanceof Uint8Array ||
    (typeof node.body === 'string' &&
      node.headers['Content-Disposition']?.startsWith('attachment'))
  ) {
    let contentId = node.headers['Content-Id'];
    if (contentId) {
      const start = contentId.indexOf('<');
      const end = contentId.indexOf('>');

      if (start !== -1 && end !== -1 && start < end) {
        contentId = contentId.substring(start + 1, end);
      } else {
        contentId = contentId.trim();
      }
    }

    attachments.push({
      contentType: node.contentType,
      body: node.body,
      contentId,
    });
  } else if (node.body instanceof Array || typeof node.body === 'object') {
    const nodes = node.body instanceof Array ? node.body : [node.body];
    for (const subnode of nodes) {
      const [_text, _html, _amp, _attachments] = extractBody(subnode);
      text += _text ? _text + '\n' : '';
      html += _html ? _html + '\n' : '';
      amp += _amp ? _amp + '\n' : '';
      if (_attachments.length > 0) {
        attachments.push(..._attachments);
      }
    }
  } else if (node.contentType.type === 'text/html') {
    html = node.body as string;
  } else if (node.contentType.type === 'text/x-amp-html') {
    amp = node.body as string;
  } else if (node.contentType.type.startsWith('text/')) {
    text = node.body as string;
  }

  return [text, html, amp, attachments] as const;
}

export function extractMail(node: LetterparserNode): LetterparserMail {
  const mail: LetterparserMail = {};

  if ('To' in node.headers) {
    mail.to = node.headers['To']?.split(',').map(s => s.trim());
  }

  if ('Cc' in node.headers) {
    mail.cc = node.headers['Cc']?.split(',').map(s => s.trim());
  }

  if ('Bcc' in node.headers) {
    mail.bcc = node.headers['Bcc']?.split(',').map(s => s.trim());
  }

  if ('From' in node.headers) {
    mail.from = node.headers['From'];
  }

  if ('Subject' in node.headers) {
    mail.subject = node.headers['Subject'];
  }

  if ('Date' in node.headers && typeof node.headers['Date'] === 'string') {
    mail.date = new Date(node.headers['Date']);
  }

  const [text, html, amp, attachments] = extractBody(node);

  mail.text = text.trim();
  mail.html = html.trim();
  mail.amp = amp.trim() || undefined;
  mail.attachments = attachments;

  return mail;
}
