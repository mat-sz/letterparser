import {
  parseBody,
  LetterparserNode,
  LetterparserContentType,
} from './parser.js';
import {
  extractMail,
  LetterparserMail,
  LetterparserAttachment,
} from './extractor.js';

export {
  LetterparserNode,
  LetterparserContentType,
  LetterparserMail,
  LetterparserAttachment,
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
