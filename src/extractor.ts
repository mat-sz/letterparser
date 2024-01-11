import { decodeMimeWords } from 'lettercoder';
import { unquote } from './helpers.js';
import {
  LetterparserNode,
  LetterparserContentType,
  parseHeaderValue,
} from './parser.js';

export interface LetterparserAttachment {
  contentType: LetterparserContentType;
  body: string | Uint8Array;
  contentId?: string;
  filename?: string;
}

export interface LetterparserMailbox {
  name?: string;
  address: string;
  raw: string;
}

export interface LetterparserMail {
  subject?: string;
  to?: LetterparserMailbox[];
  cc?: LetterparserMailbox[];
  bcc?: LetterparserMailbox[];
  date?: Date;
  from?: LetterparserMailbox;
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

  const parsedDisposition = node.headers['Content-Disposition']
    ? parseHeaderValue(node.headers['Content-Disposition'])
    : undefined;
  if (
    node.body instanceof Uint8Array ||
    (typeof node.body === 'string' &&
      parsedDisposition?.firstValue === 'attachment')
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
      filename:
        parsedDisposition?.parameters?.filename ||
        node.contentType?.parameters?.name ||
        node.headers['Content-Description'],
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

function extractMailbox(raw: string): LetterparserMailbox {
  const addressStart = raw.indexOf('<');
  const addressEnd = raw.lastIndexOf('>');
  if (addressStart !== -1 && addressEnd !== -1) {
    const address = unquote(raw.substring(addressStart + 1, addressEnd).trim());
    const name = decodeMimeWords(
      unquote(raw.substring(0, addressStart).trim())
    );
    return {
      address,
      name,
      raw: `"${name}" <${address}>`,
    };
  } else {
    return {
      address: raw.trim(),
      raw,
    };
  }
}

function extractMailboxes(raw?: string): LetterparserMailbox[] | undefined {
  if (!raw) {
    return undefined;
  }

  return raw.split(',').map(s => extractMailbox(s));
}

export function extractMail(node: LetterparserNode): LetterparserMail {
  const mail: LetterparserMail = {};

  mail.to = extractMailboxes(node.headers['To']);
  mail.cc = extractMailboxes(node.headers['Cc']);
  mail.bcc = extractMailboxes(node.headers['Bcc']);
  mail.from = node.headers['From']
    ? extractMailbox(node.headers['From'])
    : undefined;

  mail.subject = node.headers['Subject'];

  if (typeof node.headers['Date'] === 'string') {
    mail.date = new Date(node.headers['Date']);
  }

  const [text, html, amp, attachments] = extractBody(node);

  mail.text = text.trim();
  mail.html = html.trim();
  mail.amp = amp.trim() || undefined;
  mail.attachments = attachments;

  return mail;
}
