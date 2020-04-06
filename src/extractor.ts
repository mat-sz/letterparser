import { LetterparserNode, LetterparserContentType } from './parser';

export interface LetterparserAttachment {
  contentType: LetterparserContentType;
  body: string | Uint8Array;
}

export interface LetterparserMail {
  subject?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  date?: Date;
  from?: string;
  attachments?: LetterparserAttachment[];
  html?: string;
  text?: string;
}

function extractBody(node: LetterparserNode) {
  let attachments: LetterparserAttachment[] = [];
  let html = '';
  let text = '';

  if (node.body instanceof Uint8Array) {
    attachments.push({
      contentType: node.contentType,
      body: node.body,
    });
  } else if (node.body instanceof Array || typeof node.body === 'object') {
    const nodes = node.body instanceof Array ? node.body : [node.body];
    for (let subnode of nodes) {
      const [_text, _html, _attachments] = extractBody(subnode);
      text += _text + '\n';
      html += _html + '\n';
      if (_attachments.length > 0) {
        attachments.push(..._attachments);
      }
    }
  } else if (node.contentType.type === 'text/html') {
    html = node.body as string;
  } else if (node.contentType.type.startsWith('text/')) {
    text = node.body as string;
  }

  return [text, html, attachments] as const;
}

export function extractMail(node: LetterparserNode) {
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

  const [text, html, attachments] = extractBody(node);

  mail.text = text;
  mail.html = html;
  mail.attachments = attachments;

  return mail;
}
