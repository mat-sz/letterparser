import { parse } from '../src/index.js';
import { parseContentType } from '../src/parser.js';

describe('parse', () => {
  it('should parse headers by themselves', () => {
    const output = parse(`To: a@example.com\nContent-Type: text/invalid\n`);

    expect(output).toMatchObject({
      contentType: {
        type: 'text/invalid',
      },
      body: '',
      headers: {
        To: 'a@example.com',
        'Content-Type': 'text/invalid',
      },
    });
  });

  it('should parse body by itself (text/plain)', () => {
    const output = parse(`\nHello world`);

    expect(output).toMatchObject({
      contentType: {
        type: 'text/plain',
      },
      body: 'Hello world',
    });
  });

  it('should parse body with Content-Transfer-Encoding: base64 (text)', () => {
    const output = parse(
      `Content-Type: text/plain\nContent-Transfer-Encoding: base64\n\nSGVsbG8gd29ybGQ=`
    );

    expect(output).toMatchObject({
      contentType: {
        type: 'text/plain',
      },
      body: 'Hello world',
    });
  });

  it('should parse body with Content-Transfer-Encoding: base64 (bytes)', () => {
    const output = parse(
      `Content-Type: application/octet-stream\nContent-Transfer-Encoding: base64\n\nQUE=`
    );

    expect(output).toMatchObject({
      contentType: {
        type: 'application/octet-stream',
      },
      body: new Uint8Array([0x41, 0x41]),
    });
  });

  it('should parse body with Content-Transfer-Encoding: quoted-printable (text)', () => {
    const output = parse(
      `Content-Type: text/plain\nContent-Transfer-Encoding: quoted-printable\n\nHello world`
    );

    expect(output).toMatchObject({
      contentType: {
        type: 'text/plain',
      },
      body: 'Hello world',
    });
  });

  it('should parse body with Content-Transfer-Encoding: quoted-printable (bytes)', () => {
    const output = parse(
      `Content-Type: application/octet-stream\nContent-Transfer-Encoding: quoted-printable\n\n=41=41`
    );

    expect(output).toMatchObject({
      contentType: {
        type: 'application/octet-stream',
      },
      body: new Uint8Array([0x41, 0x41]),
    });
  });

  it('should parse multiline headers', () => {
    const output = parse(`X-Test-Header: test\n test\n`);

    expect(output).toMatchObject({
      headers: {
        'X-Test-Header': 'test test',
      },
    });
  });

  it('should parse multiple headers with the same name', () => {
    const output = parse(`X-Test-Header: test\nX-Test-Header: test 2\n`);

    expect(output).toMatchObject({
      headers: {
        'X-Test-Header': 'test, test 2',
      },
    });
  });

  it('should parse multipart messages', () => {
    const output = parse(
      `Content-Type: multipart/alternative; boundary="boundary"\n\n--boundary\nContent-Type: text/plain\n\nHello world!\n--boundary\nContent-Type: text/plain\n\nHello, again!\n--boundary--`
    );

    expect(output).toMatchObject({
      body: [
        {
          contentType: {
            type: 'text/plain',
          },
          body: 'Hello world!',
        },
        {
          contentType: {
            type: 'text/plain',
          },
          body: 'Hello, again!',
        },
      ],
    });
  });

  it('should parse message/*', () => {
    const output = parse(
      `To: a@example.com\nContent-Type: message/rfc822\n\nTo: b@example.com\nContent-Type: text/plain\n\nHello world!`
    );

    expect(output).toMatchObject({
      contentType: {
        type: 'message/rfc822',
      },
      headers: {
        To: 'a@example.com',
      },
      body: {
        contentType: {
          type: 'text/plain',
        },
        headers: {
          To: 'b@example.com',
        },
        body: 'Hello world!',
      },
    });
  });

  it('should throw when maximum depth is exceeded', () => {
    const input =
      `Content-Type: multipart/alternative; boundary="boundary"\n\n--boundary\n`.repeat(
        102
      );

    expect(() => parse(input)).toThrowError('Maximum depth of 99 exceeded.');
  });

  // Issue #1: https://github.com/mat-sz/letterparser/issues/1
  it('should parse multipart messages with mixed-case boundaries', () => {
    const output = parse(
      'Content-Type: multipart/mixed; boundary="--_NmP-79d22631bd047a69-Part_1"\r\n' +
        'From: me@myserver.com\r\n' +
        'To: Mike@foo.bar\r\n' +
        'Subject: New Subject\r\n' +
        'Message-ID: <4392b49b-91b4-fad0-34a5-115a5cc96fa6@myserver.com>\r\n' +
        'Date: Tue, 13 Oct 2020 19:12:21 +0000\r\n' +
        'MIME-Version: 1.0\r\n' +
        '\r\n' +
        '----_NmP-79d22631bd047a69-Part_1\r\n' +
        'Content-Type: text/plain; charset=utf-8\r\n' +
        'Content-Transfer-Encoding: 7bit\r\n' +
        '\r\n' +
        'More words I have an attachment\r\n' +
        '----_NmP-79d22631bd047a69-Part_1\r\n' +
        'Content-Type: text/plain; name="c:/temp/foo.txt"\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        'Content-Disposition: attachment; filename="c:/temp/foo.txt"\r\n' +
        '\r\n' +
        'U29tZSBzbWFsbCB3b3JkcyB0byB0ZXN0IGF0dGFjaG1lbnQ=\r\n' +
        '----_NmP-79d22631bd047a69-Part_1--'
    );

    expect(output).toMatchObject({
      body: [
        {
          contentType: {
            type: 'text/plain',
          },
          body: 'More words I have an attachment',
        },
        {
          contentType: {
            type: 'text/plain',
          },
          body: 'Some small words to test attachment',
        },
      ],
    });
  });

  // Issue #2: https://github.com/mat-sz/letterparser/issues/2
  it('should parse headers starting on new line', () => {
    const output = parse(
      'Example: hello\r\n' +
        'Message-ID:\r\n' +
        ' <xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxxxxxxxxx.xxxxxxxx.prod.outlook.com>\r\n' +
        'References:\r\n' +
        ' <xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxxxxxxxxx.xxxxxxxx.prod.outlook.com>\r\n' +
        'In-Reply-To:\r\n' +
        ' <xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxxxxxxxxx.xxxxxxxx.prod.outlook.com>\r\n' +
        'Content-Type: multipart/alternative;\r\n' +
        ' boundary="_000_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXnamp_"\r\n' +
        'MIME-Version: 1.0\r\n' +
        '\r\n' +
        '--_000_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXnamp_\r\n' +
        'Content-Type: text/plain; charset="iso-8859-1"\r\n' +
        'Content-Transfer-Encoding: quoted-printable\r\n' +
        '\r\n' +
        'example\r\n' +
        '\r\n' +
        '--_000_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXnamp_\r\n' +
        'Content-Type: text/html; charset="iso-8859-1"\r\n' +
        'Content-Transfer-Encoding: quoted-printable\r\n' +
        '\r\n' +
        '<html>\r\n' +
        '<head>\r\n' +
        '<meta http-equiv=3D"Content-Type" content=3D"text/html; charset=3Diso-8859-=\r\n' +
        '1">\r\n' +
        '</head>\r\n' +
        '<body dir=3D"ltr">\r\n' +
        'example\r\n' +
        '</body>\r\n' +
        '</html>\r\n' +
        '\r\n' +
        '--_000_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXnamp_--\r\n'
    );

    expect(output).toMatchObject({
      headers: {
        'Message-Id':
          '<xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxxxxxxxxx.xxxxxxxx.prod.outlook.com>',
        References:
          '<xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxxxxxxxxx.xxxxxxxx.prod.outlook.com>',
        'In-Reply-To':
          '<xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxxxxxxxxx.xxxxxxxx.prod.outlook.com>',
      },
      body: [
        {
          contentType: {
            type: 'text/plain',
          },
          body: 'example\n',
        },
        {
          contentType: {
            type: 'text/html',
          },
          body:
            '<html>\n' +
            '<head>\n' +
            '<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">\n' +
            '</head>\n' +
            '<body dir="ltr">\n' +
            'example\n' +
            '</body>\n' +
            '</html>\n',
        },
      ],
    });
  });

  it('should parse messages created by Gmail', () => {
    const output = parse(
      'MIME-Version: 1.0\r\n' +
        'Date: Fri, 30 Oct 2020 17:50:04 +0100\r\n' +
        'Message-ID: <xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@mail.gmail.com>\r\n' +
        'Subject: Example\r\n' +
        'From: XXXXXXX <xxxxxxxxxx@gmail.com>\r\n' +
        'To: XXXXXXX <xxxxxxxxxx@gmail.com>\r\n' +
        'Content-Type: multipart/alternative; boundary="0000000000000xxxxxxxxxxxxxxx"\r\n' +
        '\r\n' +
        '--0000000000000xxxxxxxxxxxxxxx\r\n' +
        'Content-Type: text/plain; charset="UTF-8"\r\n' +
        '\r\n' +
        'Example email from Gmail\r\n' +
        '\r\n' +
        '--0000000000000xxxxxxxxxxxxxxx\r\n' +
        'Content-Type: text/html; charset="UTF-8"\r\n' +
        '\r\n' +
        '<div dir="ltr">Example email from Gmail</div>\r\n' +
        '\r\n' +
        '--0000000000000xxxxxxxxxxxxxxx--\r\n'
    );

    expect(output).toMatchObject({
      body: [
        {
          contentType: {
            type: 'text/plain',
          },
          body: 'Example email from Gmail\n',
        },
        {
          contentType: {
            type: 'text/html',
          },
          body: '<div dir="ltr">Example email from Gmail</div>\n',
        },
      ],
    });
  });

  // Issue #3: https://github.com/mat-sz/letterparser/issues/3
  it('should parse multi-line headers with new lines starting with \\t', () => {
    const output = parse(
      'Content-Type: multipart/alternative;\r\n' +
        '\tboundary="0000000000000xxxxxxxxxxxxxxx"\r\n' +
        '\r\n' +
        '--0000000000000xxxxxxxxxxxxxxx\r\n' +
        'Content-Type: text/plain; charset="UTF-8"\r\n' +
        '\r\n' +
        'Example email from Gmail\r\n' +
        '\r\n' +
        '--0000000000000xxxxxxxxxxxxxxx\r\n' +
        'Content-Type: text/html; charset="UTF-8"\r\n' +
        '\r\n' +
        '<div dir="ltr">Example email from Gmail</div>\r\n' +
        '\r\n' +
        '--0000000000000xxxxxxxxxxxxxxx--\r\n'
    );

    expect(output).toMatchObject({
      body: [
        {
          contentType: {
            type: 'text/plain',
          },
          body: 'Example email from Gmail\n',
        },
        {
          contentType: {
            type: 'text/html',
          },
          body: '<div dir="ltr">Example email from Gmail</div>\n',
        },
      ],
    });
  });

  it('should parse multipart messages with no newline before boundary', () => {
    const output = parse(
      'Content-Type: multipart/alternative;\r\n' +
        '\tboundary="0000000000000xxxxxxxxxxxxxxx"\r\n' +
        '--0000000000000xxxxxxxxxxxxxxx\r\n' +
        'Content-Type: text/plain; charset="UTF-8"\r\n' +
        '\r\n' +
        'Example email from Gmail\r\n' +
        '--0000000000000xxxxxxxxxxxxxxx\r\n' +
        'Content-Type: text/html; charset="UTF-8"\r\n' +
        '\r\n' +
        '<div dir="ltr">Example email from Gmail</div>\r\n' +
        '--0000000000000xxxxxxxxxxxxxxx--\r\n'
    );

    expect(output).toMatchObject({
      body: [
        {
          contentType: {
            type: 'text/plain',
          },
          body: 'Example email from Gmail',
        },
        {
          contentType: {
            type: 'text/html',
          },
          body: '<div dir="ltr">Example email from Gmail</div>',
        },
      ],
    });
  });

  // Issue #5: https://github.com/mat-sz/letterparser/issues/5
  it('should parse multipart messages with a text/x-amp-html part', () => {
    const output = parse(
      'Content-Type: multipart/alternative;\r\n' +
        '\tboundary="0000000000000xxxxxxxxxxxxxxx"\r\n' +
        '--0000000000000xxxxxxxxxxxxxxx\r\n' +
        'Content-Type: text/plain; charset="UTF-8"\r\n' +
        '\r\n' +
        'Example AMP email\r\n' +
        '--0000000000000xxxxxxxxxxxxxxx\r\n' +
        'Content-Type: text/x-amp-html; charset="UTF-8"\r\n' +
        '\r\n' +
        '<!doctype html>\r\n' +
        '<html ⚡4email>\r\n' +
        '<head>\r\n' +
        '  <meta charset="utf-8">\r\n' +
        '  <style amp4email-boilerplate>body{visibility:hidden}</style>\r\n' +
        '  <script async src="https://cdn.ampproject.org/v0.js"></script>\r\n' +
        '</head>\r\n' +
        '<body>\r\n' +
        'Example AMP email\r\n' +
        '</body>\r\n' +
        '</html>\r\n' +
        '--0000000000000xxxxxxxxxxxxxxx\r\n' +
        'Content-Type: text/html; charset="UTF-8"\r\n' +
        '\r\n' +
        '<div dir="ltr">Example AMP email</div>\r\n' +
        '--0000000000000xxxxxxxxxxxxxxx--\r\n'
    );

    expect(output).toMatchObject({
      body: [
        {
          contentType: {
            type: 'text/plain',
          },
          body: 'Example AMP email',
        },
        {
          contentType: {
            type: 'text/x-amp-html',
          },
          body:
            '<!doctype html>\n' +
            '<html ⚡4email>\n' +
            '<head>\n' +
            '  <meta charset="utf-8">\n' +
            '  <style amp4email-boilerplate>body{visibility:hidden}</style>\n' +
            '  <script async src="https://cdn.ampproject.org/v0.js"></script>\n' +
            '</head>\n' +
            '<body>\n' +
            'Example AMP email\n' +
            '</body>\n' +
            '</html>',
        },
        {
          contentType: {
            type: 'text/html',
          },
          body: '<div dir="ltr">Example AMP email</div>',
        },
      ],
    });
  });

  // Issue #8: https://github.com/mat-sz/letterparser/issues/8
  it('should parse body with Content-Transfer-Encoding: base64 (text and line breaks)', () => {
    const output = parse(
      `Content-Type: text/plain\nContent-Transfer-Encoding: base64\n\nSGVsb\nG8gd2\n9ybGQ=`
    );

    expect(output).toMatchObject({
      contentType: {
        type: 'text/plain',
      },
      body: 'Hello world',
    });
  });

  // Issue #9: https://github.com/mat-sz/letterparser/issues/9
  it('should parse Content-Type using semicolon as separation between multiple parameters', () => {
    const output = parse(
      'MIME-Version: 1.0\n' +
        'Content-Type: multipart/alternative; boundary=xx-00000000000000000000000000000000; charset=UTF-8\n' +
        '\n' +
        '--xx-00000000000000000000000000000000\n' +
        'Content-Type: text/plain; charset=UTF-8\n' +
        'Content-Transfer-Encoding: quoted-printable\n' +
        '\n' +
        'Hello world.\n' +
        '--xx-00000000000000000000000000000000--'
    );

    expect(output).toMatchObject({
      body: [
        {
          contentType: {
            type: 'text/plain',
          },
          body: 'Hello world.',
        },
      ],
    });
  });
});

describe('parseContentType', () => {
  it('should parse mime words in parameters correctly', () => {
    expect(
      parseContentType(
        'application/pdf; name="=?iso-8859-1?Q?pr=FCfbericht.pdf?="'
      )
    ).toMatchObject({
      type: 'application/pdf',
      encoding: undefined,
      parameters: { name: 'prüfbericht.pdf' },
    });
  });
});
