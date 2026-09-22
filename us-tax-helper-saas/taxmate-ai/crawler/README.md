# IRS.gov Crawler

Crawls English-language HTML pages and PDF forms/publications from
`https://www.irs.gov`, saving structured data under `data/`.

## Setup

```bash
cd taxmate-ai/crawler
python -m venv .venv
.venv/Scripts/activate   # Windows
pip install -r requirements.txt
```

## Usage

Check robots.txt rules:

```bash
python -m crawler.fetch_robots
```
(run from `taxmate-ai/`, so `crawler` is importable as a package)

Small sample run (recommended first):

```bash
python -m crawler.crawl --max-pages 50
```

Full crawl:

```bash
python -m crawler.crawl --max-pages 0
```

Incremental crawl (skips URLs already in `data/index.jsonl`, for periodic re-runs):

```bash
python -m crawler.crawl --max-pages 0 --incremental
```

Output:

```
data/
  html/<slug>.json
  pdf/<filename>.pdf
  pdf/<filename>.json
  index.jsonl
crawl.log
```

Exit code is `0` if no URLs failed, `1` otherwise — useful for scheduler alerting.

## Scheduling (admin periodic crawl)

### Cron (Linux/macOS)

```cron
0 3 * * 0 cd /path/to/taxmate-ai && /path/to/.venv/bin/python -m crawler.crawl --max-pages 0 --incremental >> crawler/cron_output.log 2>&1
```

Runs weekly, Sunday 3am, incremental (only new/changed URLs are fetched — already-downloaded files are left untouched).

### Windows Task Scheduler

Create a task that runs weekly with:

- Program: `C:\path\to\taxmate-ai\crawler\.venv\Scripts\python.exe`
- Arguments: `-m crawler.crawl --max-pages 0 --incremental`
- Start in: `C:\path\to\taxmate-ai`

Or via PowerShell:

```powershell
$action = New-ScheduledTaskAction -Execute "C:\path\to\.venv\Scripts\python.exe" `
    -Argument "-m crawler.crawl --max-pages 0 --incremental" `
    -WorkingDirectory "C:\path\to\taxmate-ai"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 3am
Register-ScheduledTask -TaskName "IRSCrawler" -Action $action -Trigger $trigger
```

## Notes

- Respects `robots.txt`, limits to 2 concurrent requests, 1-2s jittered delay
  between requests, exponential backoff on 429/503 (max 3 retries).
- Only `/en/`-style (default) English paths are crawled; `/es/`, `/zh/`,
  `/ru/`, `/ar/`, `/ko/`, `/vi/` and similar are excluded, as are pages whose
  `hreflang`/`lang` indicates a non-English locale.
- PDFs are deduplicated by SHA-256 content hash; HTML/PDF URLs are
  deduplicated by a normalized URL (tracking params and trailing slash
  stripped).
- `--incremental` re-runs skip URLs already recorded in `data/index.jsonl`,
  making periodic re-crawls cheap and non-destructive to existing files.
