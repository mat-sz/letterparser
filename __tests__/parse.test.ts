import { parse } from '../src';

describe('parse', () => {
  it('parses just headers', () => {
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

  it('parses just body (text/plain)', () => {
    const output = parse(`\nHello world`);

    expect(output).toMatchObject({
      contentType: {
        type: 'text/plain',
      },
      body: 'Hello world',
    });
  });

  it('parses body with Content-Transfer-Encoding: base64 (text)', () => {
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

  it('parses body with Content-Transfer-Encoding: base64 (bytes)', () => {
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

  it('parses body with Content-Transfer-Encoding: quoted-printable (text)', () => {
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

  it('parses body with Content-Transfer-Encoding: quoted-printable (bytes)', () => {
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

  it('parses multiline headers', () => {
    const output = parse(`X-Test-Header: test\n test\n`);

    expect(output).toMatchObject({
      headers: {
        'X-Test-Header': 'test test',
      },
    });
  });

  it('parses multiple headers with the same name', () => {
    const output = parse(`X-Test-Header: test\nX-Test-Header: test 2\n`);

    expect(output).toMatchObject({
      headers: {
        'X-Test-Header': 'test, test 2',
      },
    });
  });

  it('parses multipart messages', () => {
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

  it('parses message/*', () => {
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

  it('throws when maximum depth is exceeded', () => {
    const input = `Content-Type: multipart/alternative; boundary="boundary"\n\n--boundary\n`.repeat(
      102
    );

    expect(() => parse(input)).toThrowError('Maximum depth of 99 exceeded.');
  });

  // Issue #1: https://github.com/mat-sz/letterparser/issues/1
  it('parses multipart messages with mixed-case boundaries', () => {
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
  it('parses headers starting on new line', () => {
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
});
