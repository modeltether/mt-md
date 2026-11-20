---
title: Bundle demo
status: Draft
---

# Bundle demo

Open this file in the browser, then press the **download icon** (bottom of the toolbar on the right). It saves
`bundle-demo.bundle.md` with every image below embedded at the end. If you opened it from `file://`, the first
click asks you to click again and **choose this folder** (`bundle-demo`).

## 1. Plain Markdown image

![blue PNG](img/one.png)

## 2. With a title, and a file name containing a space

![orange JPEG](<img/two photo.jpg> "A photo-style JPEG")

## 3. HTML image tag (width is dropped when bundled)

<img src="img/sub/three.gif" alt="green GIF" width="120">

## 4. Reference style (the definition is at the bottom of this file)

![purple WebP][webp]

## 5. SVG, and the same image used twice (embedded once)

![teal SVG](img/five.svg)

Again: ![teal SVG again](img/five.svg)

## 6. These stay exactly as written

An image inside a code block is only an example:

```md
![not bundled](img/one.png)
```

Inline code too: `![not bundled either](img/two photo.jpg)`.

A missing file stays a link (the toast reports it as left as a link):

![does not exist](img/missing.png)

[webp]: img/four.webp
