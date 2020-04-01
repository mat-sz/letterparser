# letterparser

letterparser is a parser library created for parsing e-mail messages. The library is written in TypeScript, fully supports both browser and server environments. The performance may not be the best at the current stage of development, parsing large messages is not recommended.

This library was created as an isomorphic alternative for [mailparser](https://github.com/nodemailer/mailparser).

The following RFCs are supported (or will be) by letterparser:

- [RFC 822](https://www.w3.org/Protocols/rfc822/)
- [RFC 1521](https://tools.ietf.org/html/rfc1521)
- [RFC 2045](https://tools.ietf.org/html/rfc2045)
- [RFC 2046](https://tools.ietf.org/html/rfc2046)
- [RFC 2822](https://tools.ietf.org/html/rfc2822)

Parsing multipart and plain text messages is currently working, although the output is raw. A function for extracting the most commonly used data will be added in a future release.

## Usage

The library exports a `parse` function that accepts a plain text body of an e-mail message.

```js
import { parse } from 'letterparser';
let res = parse(`Date: Wed, 01 Apr 2020 00:00:00 -0000
From: A <a@example.com>
To: B <b@example.com>
Subject: Hello world!
Mime-Version: 1.0
Content-Type: text/plain; charset=utf-8

Some message.`);

console.log(JSON.stringify(res));
```

The return value of that function is `LetterparserNode`, as defined below:

```js
interface LetterparserContentType {
  type: string;
  parameters: { [k: string]: string | undefined };
}

interface LetterparserNode {
  contentType: LetterparserContentType;
  headers: { [k: string]: string | undefined };
  body: LetterparserNode | LetterparserNode[] | string;
}
```

## Missing functionality

- [ ] Data extraction
- [ ] Charset support
- [ ] Parsing of message/\* types
- [ ] Support for 7-bit and 8-bit MIME
