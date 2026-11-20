# Images

![PNG](images/one.png "a png")

![JPEG with a space in its name](<images/two photo.jpg>)

![SVG](images/five.svg)

![WebP](images/four.webp)

![Missing file stays a link](images/missing.png)

Use **Export** on the toolbar (Markdown with images embedded is its default format; the gear in Settings offers HTML, Word and more) (pin it in Settings if needed). On `file://` the browser cannot let the page read these images, so it asks you to pick this folder; over http it fetches them directly. The saved file starts with a note giving the line where the text ends and the base64 data begins.
