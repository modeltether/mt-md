# Code

```js
// plain highlighting
export const add = (a, b) => a + b
```

```python linenums
def greet(name):
    return f"Hello, {name}"
```

```ts hl_lines="2 4-5"
type Point = { x: number; y: number }
const origin: Point = { x: 0, y: 0 }
function dist(a: Point, b: Point) {
  const dx = a.x - b.x
  return Math.hypot(dx, a.y - b.y)
}
```

```bash
npm run playground && echo "serving"
```

```json
{ "name": "mt-md", "version": "0.3.0" }
```

Every block has a language label and a **Copy** button.
