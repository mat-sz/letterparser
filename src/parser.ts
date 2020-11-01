import { decodeMimeWords, decodeQuotedPrintable } from 'lettercoder';
import { toByteArray } from 'base64-js';

if (typeof TextDecoder === 'undefined') {
  /* eslint-disable */
  // @ts-ignore Isomorphism.
  global['TextDecoder'] = require('util').TextDecoder;
  /* eslint-enable */
}

type Headers = { [k: string]: string | undefined };

export interface LetterparserContentType {
  type: string;
  encoding?: string;
  parameters: Headers;
}

export interface LetterparserNode {
  contentType: LetterparserContentType;
  headers: Headers;
  body: LetterparserNode | LetterparserNode[] | string | Uint8Array;
}

const MAX_DEPTH = 99;

function parseContentType(value: string): LetterparserContentType | undefined {
  if (value.includes(',')) {
    return undefined;
  }

  const split = value.split(';').map(s => s.trim());

  const parameters: any = {};
  let encoding: string | undefined;

  if (split.length == 2) {
    for (const parameter of split.slice(1)) {
      const parameterSplit = parameter.split('=');
      let value = parameterSplit[1];
      if (parameterSplit.length > 2) {
        value = parameterSplit.slice(1).join('=');
      }

      if (value.startsWith('"')) {
        value = value.substring(1);
      }

      if (value.endsWith('"')) {
        value = value.substring(0, value.length - 1);
      }

      parameters[parameterSplit[0].toLowerCase()] = value;
    }
  }

  split[0] = split[0].toLowerCase();

  if (typeof parameters['charset'] === 'string') {
    encoding = parameters['charset'].split('*')[0];
  } else if (split[0].startsWith('text/')) {
    encoding = 'utf-8';
  }

  return {
    type: split[0],
    encoding,
    parameters,
  };
}

function parseHeaders(
  lines: string[],
  lineStartIdx: number,
  lineEndIdx: number
) {
  const headers: Headers = {};
  let headerName: string | undefined;
  let headerValue: string | undefined;
  let lineIdx = lineStartIdx;

  for (; lineIdx < lineEndIdx; lineIdx++) {
    const line = lines[lineIdx];

    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (typeof headerName !== 'string' || typeof headerValue !== 'string') {
        throw new Error(
          'Unexpected space at the beginning of line ' + (lineIdx + 1)
        );
      }

      headerValue += '\n' + line.trim();
    } else {
      if (headerName && headerValue) {
        headerValue = decodeMimeWords(headerValue);
        if (headerName in headers) {
          const value = headers[headerName];

          if (typeof value === 'string') {
            headers[headerName] = value + ', ' + headerValue;
          } else {
            headers[headerName] = headerValue;
          }
        } else {
          headers[headerName] = headerValue;
        }
      }

      if (line === '') {
        break;
      }

      const colonIdx = line.indexOf(':');
      headerName = line
        .substring(0, colonIdx)
        .split('-')
        .map(s => s.charAt(0).toUpperCase() + s.substring(1).toLowerCase())
        .join('-');
      headerValue = line.substring(colonIdx + 1).trim();
    }
  }

  return [headers, lineIdx] as const;
}

export function parseBody(
  depth: number,
  lines: string[],
  lineStartIdx: number,
  lineEndIdx: number,
  lookaheadBoundaryLineIdx?: number
): readonly [LetterparserNode, number] {
  if (depth > MAX_DEPTH) {
    throw new Error('Maximum depth of ' + MAX_DEPTH + ' exceeded.');
  }

  let contents: LetterparserNode;

  let [headers, lineIdx] = parseHeaders(lines, lineStartIdx, lineEndIdx);
  const parsedType = parseContentType(headers['Content-Type'] ?? 'text/plain');
  if (!parsedType) {
    throw new Error(
      'Invalid content type "' +
        headers['Content-Type'] +
        '" at line ' +
        (lineIdx + 1)
    );
  }
  lineIdx++;

  const { type, parameters } = parsedType;

  if (type?.startsWith('message') && type !== 'message/delivery-status') {
    const endIdx = lookaheadBoundaryLineIdx ?? lineEndIdx;

    const [subcontents, newLineIdx] = parseBody(
      depth + 1,
      lines,
      lineIdx,
      endIdx
    );

    contents = {
      contentType: parsedType,
      headers,
      body: subcontents,
    };

    lineIdx = newLineIdx;
  } else if (type?.startsWith('multipart/')) {
    const boundary = parameters['boundary'];
    const contentsArray: LetterparserNode[] = [];

    if (!boundary) {
      throw new Error(
        'Multipart type lacking boundary at line ' + (lineStartIdx + 1)
      );
    }

    let finished = false;
    for (; lineIdx < lineEndIdx; lineIdx++) {
      const line = lines[lineIdx];

      if (line.startsWith('--' + boundary)) {
        if (line.startsWith('--' + boundary + '--')) {
          finished = true;
          break;
        }

        let lookaheadBoundaryLineIdx = lines
          .slice(lineIdx + 2, lineEndIdx)
          .findIndex(line => line.startsWith('--' + boundary));
        if (!lookaheadBoundaryLineIdx) {
          throw new Error(
            'Multipart parsing failure (boundary lookahead failed) at line ' +
              lineIdx
          );
        }

        lookaheadBoundaryLineIdx += lineIdx + 2;

        const [subcontents, newLineIdx] = parseBody(
          depth + 1,
          lines,
          lineIdx + 1,
          lineEndIdx,
          lookaheadBoundaryLineIdx
        );

        lineIdx = newLineIdx;

        if (!subcontents) {
          throw new Error('Multipart parsing failure at line ' + newLineIdx);
        }

        contentsArray.push(subcontents);
      }
    }

    if (!finished) {
      throw new Error(
        'Reached line ' +
          (lineIdx + 1) +
          ' expecing boundary "--' +
          boundary +
          '--", but none was found'
      );
    }

    contents = {
      contentType: parsedType,
      headers,
      body: contentsArray,
    };
  } else {
    const endIdx = lookaheadBoundaryLineIdx ?? lineEndIdx;
    const stringBody: string = lines.slice(lineIdx, endIdx).join('\n');
    let body: string | Uint8Array = stringBody;

    if (headers['Content-Transfer-Encoding']) {
      if (parsedType.encoding) {
        switch (headers['Content-Transfer-Encoding'].toLowerCase()) {
          case 'base64':
            {
              const decoder = new TextDecoder(parsedType.encoding);
              body = decoder.decode(toByteArray(stringBody));
            }
            break;
          case 'quoted-printable':
            body = decodeQuotedPrintable(
              stringBody,
              parsedType.encoding
            ) as string;
            break;
        }
      } else {
        switch (headers['Content-Transfer-Encoding'].toLowerCase()) {
          case 'base64':
            body = toByteArray(stringBody);
            break;
          case 'quoted-printable':
            body = decodeQuotedPrintable(
              stringBody,
              parsedType.encoding
            ) as Uint8Array;
            break;
        }
      }
    }

    contents = {
      contentType: parsedType,
      headers,
      body: body,
    };

    lineIdx = endIdx - 1;
  }

  return [contents, lineIdx] as const;
}
