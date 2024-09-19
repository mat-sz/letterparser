import {
  parseBody,
  LetterparserNode,
  LetterparserContentType,
  parseHeadersFromLines,
  LetterparserHeaders,
} from './parser.js';
import {
  extractMail,
  LetterparserMail,
  LetterparserAttachment,
  extractFromHeaders,
} from './extractor.js';

export {
  LetterparserNode,
  LetterparserContentType,
  LetterparserMail,
  LetterparserAttachment,
  LetterparserHeaders,
};

export function extract(message: string | LetterparserNode): LetterparserMail {
  if (typeof message === 'string') {
    return extractMail(parse(message));
  } else {
    return extractMail(message);
  }
}

export function parse(message: string): LetterparserNode {
  const lines = message.replace(/\r/g, '').split('\n');
  const [contents] = parseBody(1, lines, 0, lines.length);
  return contents;
}

export function extractHeaders(
  message: string | LetterparserHeaders
): LetterparserMail {
  if (typeof message === 'string') {
    return extractFromHeaders(parseHeaders(message));
  } else {
    return extractFromHeaders(message);
  }
}

export function parseHeaders(data: string) {
  const lines = data.replace(/\r/g, '').split('\n');
  const [headers] = parseHeadersFromLines(lines, 0, lines.length);
  return headers;
}
