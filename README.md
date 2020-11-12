<h1 align="center">
  <img src="https://raw.githubusercontent.com/mat-sz/letterparser/master/logo.png" alt="letterparser" width="700">
</h1>

<p align="center">
<img alt="workflow" src="https://img.shields.io/github/workflow/status/mat-sz/letterparser/Node.js%20CI%20(yarn)">
<a href="https://npmjs.com/package/letterparser">
<img alt="npm" src="https://img.shields.io/npm/v/letterparser">
<img alt="npm" src="https://img.shields.io/npm/dw/letterparser">
<img alt="NPM" src="https://img.shields.io/npm/l/letterparser">
</a>
</p>

**letterparser** is a parser library created for parsing e-mail messages. The library is written in TypeScript, fully supports both browser and server environments. The performance may not be the best at the current stage of development, parsing large messages is not recommended.

This library was created as an isomorphic alternative for [mailparser](https://github.com/nodemailer/mailparser).

The following RFCs are supported (or will be) by letterparser:

- [RFC 5322](https://tools.ietf.org/html/rfc5322.html)
- [RFC 6532](https://tools.ietf.org/html/rfc6532.html)
- [RFC 2046](https://tools.ietf.org/html/rfc2046.html)

Parsing multipart and plain text messages is currently working, although the output is raw. A function for extracting the most commonly used data will be added in a future release.

| Builder                                                  | Inbound SMTP                                   |
| -------------------------------------------------------- | ---------------------------------------------- |
| [letterbuilder](https://github.com/mat-sz/letterbuilder) | [microMTA](https://github.com/mat-sz/microMTA) |

## Usage

> **WARNING!** [node.js built with full ICU is required](https://nodejs.org/api/intl.html). (full-icu NPM package may work as a substitute, although this is not recommended.)
>
> By default, recent node.js versions ship full ICU binaries. Incomplete ICU will result in bad encoding errors.

### General information

To get information about the message, use `extract`:

```js
import { parse } from 'letterparser';
let res = parse(`Date: Wed, 01 Apr 2020 00:00:00 -0000
From: A <a@example.com>
To: B <b@example.com>
Subject: Hello world!
Mime-Version: 1.0
Content-Type: text/plain; charset=utf-8

Some message.`);
```

The function returns `LetterparserMail`:

```ts
export interface LetterparserAttachment {
  contentType: LetterparserContentType;
  body: string | Uint8Array;
}

export interface LetterparserMail {
  subject?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  from?: string;
  attachments?: LetterparserAttachment[];
  html?: string;
  text?: string;
}
```

### Message structure

The library also exports a `parse` function that outputs the raw structure of the message.

```js
import { parse } from 'letterparser';
let node = parse(`Date: Wed, 01 Apr 2020 00:00:00 -0000
From: A <a@example.com>
To: B <b@example.com>
Subject: Hello world!
Mime-Version: 1.0
Content-Type: text/plain; charset=utf-8

Some message.`);
```

The return value of that function is `LetterparserNode`, as defined below:

```ts
interface LetterparserContentType {
  type: string;
  encoding?: string;
  parameters: Headers;
}

interface LetterparserNode {
  contentType: LetterparserContentType;
  headers: Headers;
  body: LetterparserNode | LetterparserNode[] | string | Uint8Array;
}
```
