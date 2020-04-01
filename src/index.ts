type Headers = { [k: string]: string | undefined };

export interface LetterparserContentType {
  type: string;
  parameters: { [k: string]: string | undefined };
}

export interface LetterparserNode {
  contentType: LetterparserContentType;
  headers: { [k: string]: string | string[] | undefined };
  body: LetterparserNode | LetterparserNode[] | string;
}

const MAX_DEPTH = 99;

function parseContentType(value: string): LetterparserContentType | undefined {
  if (value.includes(',')) {
    return undefined;
  }

  const split = value.split(';').map(s => s.trim());

  let parameters: any = {};
  if (split.length == 2) {
    for (let parameter of split.slice(1)) {
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

  return {
    type: split[0],
    parameters,
  };
}

function parseHeaders(
  lines: string[],
  lineStartIdx: number,
  lineEndIdx: number
) {
  let headers: Headers = {};
  let headerName: string | undefined;
  let headerValue: string | undefined;
  let lineIdx = lineStartIdx;

  for (; lineIdx < lineEndIdx; lineIdx++) {
    const line = lines[lineIdx];

    if (line.startsWith(' ')) {
      if (!headerName || !headerValue) {
        throw new Error(
          'Unexpected space at the beginning of line ' + (lineIdx + 1)
        );
      }

      headerValue += '\n' + line.trim();
    } else {
      if (headerName && headerValue) {
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

function parseBody(
  depth: number,
  lines: string[],
  lineStartIdx: number,
  lineEndIdx: number,
  lookaheadBoundaryLineIdx?: number
) {
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
  } else if (type?.startsWith('multipart')) {
    const boundary = parameters['boundary'];
    let contentsArray: LetterparserNode[] = [];

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
        } else {
          lookaheadBoundaryLineIdx += lineIdx + 1;
        }

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

    contents = {
      contentType: parsedType,
      headers,
      body: lines.slice(lineIdx, endIdx).join('\n'),
    };

    lineIdx = endIdx;
  }

  return [contents, lineIdx] as const;
}

export function parse(message: string) {
  let lines = message.replace(/\r/g, '').split('\n');
  const [contents] = parseBody(1, lines, 0, lines.length);
  return contents;
}
