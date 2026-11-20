# Canvas

Fences labelled `canvas` (or `jsoncanvas`) hold a [JSON Canvas](https://jsoncanvas.org) document, the open format Obsidian uses. Copy the contents of a `.canvas` file into the fence. Text, file and link nodes, groups and labelled edges are drawn; the colours `"1"` to `"6"` and `#hex` values work.

```canvas
{
  "nodes": [
    { "id": "g", "type": "group", "x": -20, "y": -60, "width": 700, "height": 340, "label": "Reading" },
    { "id": "a", "type": "text", "x": 0, "y": 0, "width": 220, "height": 90, "text": "# Open a file\nA .md file, local or on localhost", "color": "4" },
    { "id": "b", "type": "text", "x": 300, "y": 0, "width": 220, "height": 90, "text": "**Rendered** page with contents panel", "color": "5" },
    { "id": "c", "type": "file", "x": 300, "y": 160, "width": 220, "height": 60, "file": "notes/ideas.md" },
    { "id": "d", "type": "link", "x": 0, "y": 160, "width": 220, "height": 60, "url": "https://jsoncanvas.org" }
  ],
  "edges": [
    { "id": "e1", "fromNode": "a", "toNode": "b", "label": "renders" },
    { "id": "e2", "fromNode": "b", "toNode": "c", "color": "2" },
    { "id": "e3", "fromNode": "d", "toNode": "a", "toEnd": "none", "color": "#8957e5" }
  ]
}
```

## Not a canvas

```canvas
{ "nodes": [] }
```
