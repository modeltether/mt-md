# Math and code

Inline math like $E = mc^2$ and display equations:

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$

$$
\hat{f}(\xi) = \int f(x)\, e^{-2\pi i x \xi}\, dx
$$

```python
def fib(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
```

```js
const total = items.reduce((sum, i) => sum + i.price, 0)
console.log(`Total: ${total}`)
```
