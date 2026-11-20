#!/usr/bin/env python3
"""Dark-theme store screenshot: load the page, press the toolbar Theme button over CDP, capture.
usage: store-shot-dark.py <extension-dir> <url> <out.png>"""
import asyncio, base64, json, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
import websockets

ext, url, out = sys.argv[1:4]
prof = tempfile.mkdtemp()
proc = subprocess.Popen(["chromium", "--headless=new", "--no-sandbox", "--remote-debugging-port=0",
    f"--user-data-dir={prof}", f"--disable-extensions-except={ext}", f"--load-extension={ext}",
    "--window-size=1280,800", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    f = Path(prof) / "DevToolsActivePort"
    for _ in range(100):
        if f.exists(): break
        time.sleep(0.1)
    port = f.read_text().split()[0]
    pages = [t for t in json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json")) if t["type"] == "page"]

    async def run():
        async with websockets.connect(pages[0]["webSocketDebuggerUrl"], max_size=None) as ws:
            n = 0
            async def call(method, **params):
                nonlocal n; n += 1; mid = n
                await ws.send(json.dumps({"id": mid, "method": method, "params": params}))
                while True:
                    r = json.loads(await ws.recv())
                    if r.get("id") == mid: return r.get("result", {})
            await call("Emulation.setDeviceMetricsOverride", width=1280, height=800, deviceScaleFactor=1, mobile=False)
            await call("Page.navigate", url=url)
            await asyncio.sleep(8)
            await call("Runtime.evaluate", expression="(() => { const b = document.getElementById('mt-md-btn-theme'); for (let i = 0; i < 3 && !document.documentElement.classList.contains('mt-md-dark'); i++) b.click(); document.body.style.margin = '0' })()")
            await asyncio.sleep(3)
            shot = await call("Page.captureScreenshot", format="png")
            Path(out).write_bytes(base64.b64decode(shot["data"]))
    asyncio.run(run())
finally:
    proc.terminate()
