import { parseBody, LetterparserNode } from './parser';
import { extractMail, LetterparserMail } from './extractor';

export { LetterparserNode };

export function extract(message: string | LetterparserNode): LetterparserMail {
  if (typeof message === 'string') {
    return extractMail(parse(message));
  } else {
    return extractMail(message);
  }
}

export function parse(message: string): LetterparserNode {
  let lines = message.replace(/\r/g, '').split('\n');
  const [contents] = parseBody(1, lines, 0, lines.length);
  return contents;
}
