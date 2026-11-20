---
title: Sample Document
author: Model Tether
date: 2026-02-23
status: Draft
audience: Infrastructure Team
version: 1.0
---

# Sample Document

This is a *sample* document for exercising mt-md.

## Core Markdown

| Col A | Col B |
|---|---|
| 1 | one |
| 2 | two |

- [x] task done
- [ ] task open

Footnote here.[^1]

Strikethrough: ~~old~~. Sub: H~2~O. Sup: x^2^.

[^1]: A footnote.

## Diagrams

```mermaid
sequenceDiagram
    Alice->>Bob: Hello
    Bob-->>Alice: Hi back
```

```mermaid
flowchart LR
    A[Start] --> B{Choice}
    B --> C[Done]
```

## Details and code

Some `inline code` and a fenced block:

```js linenums hl_lines="2 3"
function hello(name) {
  const msg = `hello, ${name}`
  return msg
}
console.log(hello("world"))
```

> [!NOTE]
> An informational note.

> [!WARNING]
> Something to be careful about.

> [!TIP]
> A helpful suggestion.

+++ Click to expand

Hidden content here, including a **list**:

- one
- two

+++

```dot
digraph G {
    A -> B;
    A -> D;
}
```

Inline math $E = mc^2$ and a price of $5 and $10 stay text.

$$\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}$$
