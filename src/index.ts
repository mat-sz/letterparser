import { parseBody, LetterparserNode } from './parser';
import { LetterparserMail } from './extractor';

export { LetterparserNode };

export function extract(message: string | LetterparserNode): LetterparserMail {
  if (typeof message === 'string') {
    return extract(parse(message));
  } else {
    return extract(message);
  }
}

export function parse(message: string): LetterparserNode {
  let lines = message.replace(/\r/g, '').split('\n');
  const [contents] = parseBody(1, lines, 0, lines.length);
  return contents;
}
