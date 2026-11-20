# Infographics

Fences labelled `infographic` use the [AntV Infographic](https://github.com/antvis/Infographic) text syntax: the first line names a template, and the data follows. It draws offline: the library's font and icon downloads are removed, so icon names are ignored.

```infographic
infographic list-row-simple-horizontal-arrow
data
  lists
    - label Step 1
      desc Open a file
    - label Step 2
      desc Read it
    - label Step 3
      desc Share it
```

## A chart

```infographic
infographic chart-column-simple
data
  lists
    - label Notes
      value 12
    - label Specs
      value 7
    - label Plans
      value 9
```

## A comparison

```infographic
infographic compare-binary-horizontal-simple-vs
data
  compares
    - label Before
      children
        - label Plain text everywhere
        - label No diagrams
    - label After
      children
        - label Rendered and themed
        - label Diagrams drawn in place
```

## Not an infographic

```infographic
this has no template
```
