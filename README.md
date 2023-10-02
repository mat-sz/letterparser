<h1 align="center">
  <img src="https://raw.githubusercontent.com/mat-sz/letterparser/master/logo.png" alt="letterparser" width="700">
</h1>

<p align="center">
<img alt="workflow" src="https://img.shields.io/github/actions/workflow/status/mat-sz/letterparser/node.js.yml?branch=master">
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

| Builder                                                  | SMTP client/server                                 |
| -------------------------------------------------------- | -------------------------------------------------- |
| [letterbuilder](https://github.com/mat-sz/letterbuilder) | [@typemail/smtp](https://github.com/typemail/smtp) |

## Usage

> **WARNING!** [node.js built with full ICU is required](https://nodejs.org/api/intl.html). (full-icu NPM package may work as a substitute, although this is not recommended.)
>
> By default, recent node.js versions ship full ICU binaries. Incomplete ICU will result in bad encoding errors.

### General information

To get information about the message, use `extract`:

```js
import { extract } from 'letterparser';
let res = extract(`Date: Wed, 01 Apr 2020 00:00:00 -0000
From: A <a@example.com>
To: B <b@example.com>
Subject: Hello world!
Mime-Version: 1.0
Content-Type: text/plain; charset=utf-8

Some message.`);
```

The function returns `LetterparserMail`:

```ts
export interface LetterparserMailbox {
  name?: string;
  address: string;
  raw: string;
}

export interface LetterparserAttachment {
  contentType: LetterparserContentType;
  body: string | Uint8Array;
  contentId?: string;
  filename?: string;
}

export interface LetterparserMail {
  subject?: string;
  to?: LetterparserMailbox[];
  cc?: LetterparserMailbox[];
  bcc?: LetterparserMailbox[];
  from?: LetterparserMailbox;
  attachments?: LetterparserAttachment[];
  html?: string;
  text?: string;
  amp?: string;
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

Headers names are normalized to be camel case with dashes.

E.g.

`Content-ID` becomes `Content-Id`

`content-type` becomes `Content-Type`
