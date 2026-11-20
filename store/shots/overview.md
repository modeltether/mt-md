---
title: Network Runbook
author: Model Tether
date: 2026-10-17
status: Approved
audience: Home lab
---

# Network Runbook

Plain `.md` files open as a **clean, readable document**: table of contents, themes, syntax highlighting and print layout, all rendered locally in the browser.

> [!NOTE]
> Nothing leaves your machine. Rendering happens entirely inside the page.

> [!WARNING]
> Admonitions use the GitHub `> [!TYPE]` syntax.

## Services

| Host | Role | Port |
|---|---|---|
| web-01 | Reverse proxy | 443 |
| router | DNS, DHCP | 53 |
| nas | Storage | 2049 |

- [x] Add DNS override
- [x] Publish install page
- [ ] Rotate keys

## Restart a service

```bash
systemctl restart caddy
journalctl -u caddy -n 20 --no-pager
```

<details>
<summary>Rollback steps</summary>

Re-run the previous deploy and confirm the health check.

</details>
