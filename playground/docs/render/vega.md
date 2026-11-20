# Vega and Vega-Lite

Charts are described as JSON inside the page. The data has to be in the chart itself: a chart cannot fetch a URL.

## Vega-Lite bar chart

```vega-lite
{
  "width": 360, "height": 200,
  "title": "Documents by type",
  "data": { "values": [
    { "type": "Notes", "n": 12 }, { "type": "Specs", "n": 7 },
    { "type": "Plans", "n": 9 }, { "type": "Logs", "n": 4 }
  ] },
  "mark": "bar",
  "encoding": {
    "x": { "field": "type", "type": "nominal", "sort": null },
    "y": { "field": "n", "type": "quantitative", "title": "count" },
    "color": { "field": "type", "type": "nominal", "legend": null }
  }
}
```

## Vega-Lite line chart

```vega-lite
{
  "width": 360, "height": 200,
  "data": { "values": [
    { "x": 1, "y": 3 }, { "x": 2, "y": 5 }, { "x": 3, "y": 4 },
    { "x": 4, "y": 8 }, { "x": 5, "y": 7 }, { "x": 6, "y": 11 }
  ] },
  "mark": { "type": "line", "point": true },
  "encoding": {
    "x": { "field": "x", "type": "quantitative" },
    "y": { "field": "y", "type": "quantitative" }
  }
}
```

## Vega (full grammar)

```vega
{
  "width": 300, "height": 180, "padding": 5,
  "data": [{ "name": "t", "values": [
    { "c": "a", "v": 28 }, { "c": "b", "v": 55 }, { "c": "c", "v": 43 }, { "c": "d", "v": 91 }
  ] }],
  "scales": [
    { "name": "x", "type": "band", "domain": { "data": "t", "field": "c" }, "range": "width", "padding": 0.2 },
    { "name": "y", "type": "linear", "domain": { "data": "t", "field": "v" }, "range": "height", "nice": true }
  ],
  "axes": [{ "orient": "bottom", "scale": "x" }, { "orient": "left", "scale": "y" }],
  "marks": [{
    "type": "rect", "from": { "data": "t" },
    "encode": { "enter": {
      "x": { "scale": "x", "field": "c" }, "width": { "scale": "x", "band": 1 },
      "y": { "scale": "y", "field": "v" }, "y2": { "scale": "y", "value": 0 },
      "fill": { "value": "#4c78a8" }
    } }
  }]
}
```

## Data from a URL is refused

```vega-lite
{ "data": { "url": "https://example.com/data.csv" }, "mark": "bar" }
```

This one shows an error that says so, and nothing is requested.
