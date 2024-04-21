import { extract } from '../src/index.js';

describe('extract', () => {
  it('should extract information from a test message', () => {
    const output = extract(`Date: Wed, 01 Apr 2020 00:00:00 -0000
From: A <a@example.com>
To: B <b@example.com>
Subject: Hello world!
Mime-Version: 1.0
Content-Type: text/plain; charset=utf-8

Some message.`);

    expect(output).toMatchObject({
      text: 'Some message.',
      from: {
        name: 'A',
        address: 'a@example.com',
        raw: '"A" <a@example.com>',
      },
      to: [
        {
          name: 'B',
          address: 'b@example.com',
          raw: '"B" <b@example.com>',
        },
      ],
      subject: 'Hello world!',
      date: new Date('Wed, 01 Apr 2020 00:00:00 -0000'),
    });
  });

  // Issue #5: https://github.com/mat-sz/letterparser/issues/5
  it('should extract AMP data from a text/x-amp-html message', () => {
    const output = extract(
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
      html: '<div dir="ltr">Example AMP email</div>',
      text: 'Example AMP email',
      amp:
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
    });
  });

  it('should extract content ID along with the attachments', () => {
    const output = extract(`Date: Sun, 24 Oct 2021 05:00:03 +0000
From: "Lorem Ipsum" <lorem@ipsum.com>
To: "Foo Bar" <foobor@test.com>
Cc: "Abc Def" <abc@def.com>
Bcc: <fgh@jkl.com>, <test2@test.com>, "Name" <test3@test.com>
Message-ID: <56y7xuld2n9-1635051603230@ipsum.com>
Subject: =?utf-8?B?8J+agCBJc3N1ZSA0OSE=?=
MIME-Version: 1.0
X-Abc: asdildffdişfsdi
Content-Type: multipart/mixed; boundary=tdplbi0e8pj

--tdplbi0e8pj
Content-Type: multipart/alternative; boundary=oagdypniyp

--oagdypniyp
Content-Type: text/plain; charset=UTF-8

Hi,
I'm a simple text.

--oagdypniyp
Content-Type: text/html; charset=UTF-8

Hi,
I'm <strong>a bold</strong> text.

--oagdypniyp--
--tdplbi0e8pj
Content-Type: image/png; charset=UTF-8
Content-Transfer-Encoding: base64
Content-Disposition: attachment;filename="test.png"
Content-ID: <abcdef-1635051603230@ipsum.com>

iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=

--tdplbi0e8pj--`);

    expect(output).toMatchObject({
      html: "Hi,\nI'm <strong>a bold</strong> text.",
      text: "Hi,\nI'm a simple text.",
      from: {
        name: 'Lorem Ipsum',
        address: 'lorem@ipsum.com',
        raw: '"Lorem Ipsum" <lorem@ipsum.com>',
      },
      to: [
        {
          name: 'Foo Bar',
          address: 'foobor@test.com',
          raw: '"Foo Bar" <foobor@test.com>',
        },
      ],
    });

    expect(output.attachments?.[0]?.contentId).toBe(
      'abcdef-1635051603230@ipsum.com'
    );
    expect(output.attachments?.[0]?.filename).toBe('test.png');
  });

  // https://github.com/mat-sz/letterparser/issues/14
  it('should handle mime words in from/to headers', () => {
    const output =
      extract(`Subject: =?utf-8?Q?Cancelled_Reservation_-_Automation_-_C's_Location;_Sensors;_Sensor2_-_CEDITtest?=
To: "=?utf-8?Q?qaautomation@xxxystemsdev=2Eonmicrosoft=2Ecom?=" <qaautomation@xxxystemsdev.onmicrosoft.com>
From: "=?utf-8?Q?sgmh@xxx=2Elocal?=" <sgmh@xxx.local>
Mime-Version: 1.0
Content-Type: text/plain; charset=utf-8

Some message.`);

    expect(output).toMatchObject({
      text: 'Some message.',
      from: {
        name: 'sgmh@xxx.local',
        address: 'sgmh@xxx.local',
        raw: '"sgmh@xxx.local" <sgmh@xxx.local>',
      },
      to: [
        {
          name: 'qaautomation@xxxystemsdev.onmicrosoft.com',
          address: 'qaautomation@xxxystemsdev.onmicrosoft.com',
          raw: '"qaautomation@xxxystemsdev.onmicrosoft.com" <qaautomation@xxxystemsdev.onmicrosoft.com>',
        },
      ],
      subject:
        "Cancelled Reservation - Automation - C's Location; Sensors; Sensor2 - CEDITtest",
    });
  });

  // https://github.com/mat-sz/letterparser/issues/16
  it('should allow for commas if quoted', () => {
    const output = extract(`Date: Wed, 01 Apr 2020 00:00:00 -0000
From: "last, first" <a@example.com>
To: "last, first" <b@example.com>
Subject: Hello world!
Mime-Version: 1.0
Content-Type: text/plain; charset=utf-8

Some message.`);

    expect(output).toMatchObject({
      text: 'Some message.',
      from: {
        name: 'last, first',
        address: 'a@example.com',
        raw: '"last, first" <a@example.com>',
      },
      to: [
        {
          name: 'last, first',
          address: 'b@example.com',
          raw: '"last, first" <b@example.com>',
        },
      ],
      subject: 'Hello world!',
      date: new Date('Wed, 01 Apr 2020 00:00:00 -0000'),
    });
  });
});
