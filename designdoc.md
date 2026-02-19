
---

# WordPress QA Screenshot Tool — Design Doc

## 1) Goal

Provide a **fast, manual smoke test** after WordPress plugin/theme updates.

The tool should:

* Run locally via:

```
pnpm go
```

* Validate **20–40 URLs**
* Detect major failures quickly:

  * Page doesn’t load
  * Console errors
  * Network failures (4xx/5xx)
  * Missing critical elements
  * Timeouts
* Capture **desktop + optional mobile screenshots**
* Output results for **rapid human QA**

This is **not** a full regression framework.
Priority: **simplicity, speed, reliability, ship fast**.

---

## 2) High-Level Behaviour

Workflow:

1. User runs:

```
pnpm go
```

2. Script:

* Loads `config.yaml`
* Builds URL list (with defaults merged)
* Runs checks in parallel (4–6 workers)
* For each URL:

  * Load page
  * Capture errors + metrics
  * Take screenshot(s)

3. Output:

```
output/
  2026-02-19-1030/
    example-com-home.desktop.png
    example-com-home.mobile.png
    example-com-blog.desktop.png
```

4. Console summary:

```
Checked: 32
Passed: 29
Failed: 3

Failures:
- https://example.com/blog (console errors)
- https://example.com/pricing (missing selector)
- https://example.com/about (network failures)

Screenshots: output/2026-02-19-1030
```

---

## 3) Tech Stack

* Node.js
* Playwright
* pnpm
* YAML parser (`yaml` npm package)

---

## 4) Project Structure

```
project/
  package.json
  pnpm-lock.yaml
  config.yaml
  src/
    run.ts
    worker.ts
    utils.ts
  output/        # gitignored
```

### .gitignore

```
output/
node_modules/
```

---

## 5) Command

package.json

```json
{
  "scripts": {
    "go": "ts-node src/run.ts"
  }
}
```

---

## 6) Configuration (YAML)

Requirements:

* Full URLs (multiple domains supported)
* `_default` provides global options
* Page settings override defaults

### YAML Structure

```yaml
_default:
  fullPage: true
  mobile: false
  timeoutMs: 10000
  requiredSelectors: []
  abortIfFail: false

pages:
  https://example.com/:
    mobile: true
    abortIfFail: true

  https://example.com/contact:
    requiredSelectors:
      - form

  https://anotherdomain.com/landing:
    mobile: true
    requiredSelectors:
      - .hero
```

### Merge Logic

Final options per page:

```
final = {
  ..._default,
  ...pageOptions
}
```

---

## 7) Output Design

All screenshots stored locally and **not version controlled**.

Structure:

```
output/
  2026-02-19-1030/
    example-com-home.desktop.png
    example-com-home.mobile.png
    example-com-contact.desktop.png
```

### Folder naming

Timestamp format:

```
YYYY-MM-DD-HHmm
```

---

## 8) Filename Slugging

Format:

```
{domain}-{path}.{device}.png
```

Examples:

| URL                                                            | Filename                          |
| -------------------------------------------------------------- | --------------------------------- |
| [https://example.com/](https://example.com/)                   | example-com-home.desktop.png      |
| [https://example.com/blog/post](https://example.com/blog/post) | example-com-blog-post.desktop.png |
| [https://app.site.com/login](https://app.site.com/login)       | app-site-com-login.desktop.png    |

Rules:

* Replace dots with dashes
* Remove protocol
* `/` → `-`
* Root path → `home`

---

## 9) Page Checks (Quick Wins Included)

For each URL:

### 9.1 Load

* `page.goto(url)`
* Wait for: `networkidle`
* Timeout: `timeoutMs` (default 10s)

Fail if:

* Timeout
* Status ≠ 200

---

### 9.2 Console Errors

Capture:

* `page.on('console')` (type === error)
* `page.on('pageerror')`

If any errors → FAIL

---

### 9.3 Network Failures

Track requests:

* response status >= 400
* request failed

If any failures → FAIL

---

### 9.4 Required Selectors

If configured:

```
await page.$(selector)
```

If missing → FAIL

---

### 9.5 Load Time Warning

Measure navigation time.

If > 5s:

```
WARNING: slow page
```

Does **not fail**, just logs.

---

## 10) Screenshots

### Desktop (always)

Viewport:

```
1280x800
```

### Mobile (optional)

If `mobile: true`:

Device:

```
iPhone 13
```

File suffix:

```
.mobile.png
```

---

## 11) Parallel Execution

* Worker pool: **5 concurrent pages**
* Expected runtime:

  * 20–40 pages → ~30–90 seconds

---

## 12) Catastrophic Failure Handling

If a page has:

```
abortIfFail: true
```

and it fails:

→ Stop remaining checks immediately.

Typical use:

```
homepage
critical landing pages
```

---

## 13) Console Summary

At end:

```
Pages checked: 32
Passed: 30
Failed: 2

Failures:
- https://example.com (status 500)
- https://example.com/blog (console errors)

Warnings:
- https://example.com/pricing (slow: 6.2s)

Screenshots:
output/2026-02-19-1030
```

Summary should be **short and readable**.

---

## 14) QA Workflow

After plugin update:

```
pnpm go
```

QA steps:

1. Check console summary
2. Open:

```
output/<timestamp>
```

3. Scroll images quickly
4. Look for:

* Blank pages
* Layout breaks
* Missing assets
* Mobile issues

---

## 15) Future (Not in MVP)

* Image diff vs baseline
* Slack alerts
* Form submission tests
* GitHub Action

---

## 16) MVP Scope (Ship Target)

Must include:

* YAML config with `_default`
* Full URL support
* Parallel execution
* Status check
* Console error detection
* Network failure detection
* Required selector check
* Desktop screenshots
* Optional mobile
* Timestamped output folder
* URL slug filenames
* Abort-on-fail support
* `pnpm go`

---

If you want the next step, I can give you a **copy-paste MVP implementation (~120 lines)** — this design is sized so you can realistically ship it in **under 1 hour**.
