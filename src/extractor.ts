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
  from?: string;
  attachments?: LetterparserAttachment[];
  html?: string;
  text?: string;
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

  if (node.body instanceof Array) {
    for (let subnode of node.body) {
      if (subnode.contentType.type === 'text/html') {
        mail.html = subnode.body as string;
      } else if (subnode.contentType.type.startsWith('text/')) {
        mail.text = subnode.body as string;
      }
    }
  } else if (node.contentType.type === 'text/html') {
    mail.html = node.body as string;
  } else if (node.contentType.type.startsWith('text/')) {
    mail.text = node.body as string;
  }

  return mail;
}
