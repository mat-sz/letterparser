import { extract } from '../src';

describe('extract', () => {
  it('extracts information from a test message', () => {
    const output = extract(`Date: Wed, 01 Apr 2020 00:00:00 -0000
From: A <a@example.com>
To: B <b@example.com>
Subject: Hello world!
Mime-Version: 1.0
Content-Type: text/plain; charset=utf-8

Some message.`);

    expect(output).toMatchObject({
      text: 'Some message.',
      from: 'A <a@example.com>',
      to: ['B <b@example.com>'],
      subject: 'Hello world!',
      date: new Date('Wed, 01 Apr 2020 00:00:00 -0000'),
    });
  });
});
