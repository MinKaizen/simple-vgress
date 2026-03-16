# VGress Web - Visual Regression Testing Dashboard

A web-based visual regression testing tool for WordPress QA. This is the web interface for the simple-vgress CLI tool, providing a GUI for non-technical team members to run tests, view results, and manage baselines.

## Features

- **Simple Email/Password Authentication** - Secure login with admin credentials set via environment variables
- **Visual Regression Testing** - Capture screenshots and compare against baselines
- **Slider/Overlay Diff Viewer** - Interactive comparison of baseline vs current screenshots
- **Scheduled Runs** - Automatic daily runs with configurable cron schedules
- **On-Demand Runs** - Manually trigger tests with custom configurations
- **Baseline Management** - Promote runs to baseline, view history, restore old baselines
- **Retention Policies** - Automatic cleanup of old runs and baselines
- **Notifications** - Zapier webhook integration for run notifications
- **Multi-device Support** - Test across desktop, mobile, and tablet viewports

## Requirements

- Node.js 18+
- pnpm (or npm/yarn)
- Chromium browser (installed automatically by Playwright)

## Setup

### 1. Install Dependencies

```bash
cd web
pnpm install
```

### 2. Install Playwright Browsers

```bash
pnpm exec playwright install chromium
```

### 3. Configure Environment

Copy the example environment file and configure:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:

```env
# Admin credentials (required)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-secure-password

# NextAuth secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=generate-a-secure-random-string
NEXTAUTH_URL=http://localhost:3000

# Zapier webhook for notifications (optional)
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/your-webhook-id

# Data directory
DATA_DIR=./data
```

The admin user will be automatically created on first startup with the credentials specified in the environment variables.

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

## Production Deployment

### Build

```bash
pnpm build
```

### Run with PM2 (Recommended)

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'vgress-web',
    script: 'pnpm',
    args: 'start',
    cwd: '/path/to/simple-vgress/web',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

Start:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name vgress.dashdot.com.au;

    ssl_certificate /etc/letsencrypt/live/vgress.dashdot.com.au/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vgress.dashdot.com.au/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name vgress.dashdot.com.au;
    return 301 https://$server_name$request_uri;
}
```

## Configuration

### Test Configuration (YAML)

Edit configurations via the web UI at `/settings/config` or directly:

- `data/config/on-demand.yaml` - Used for manual runs
- `data/config/scheduled.yaml` - Used for scheduled runs

Example configuration:

```yaml
_default:
  fullPage: true
  devices: ["desktop", "mobile", "tablet"]
  timeoutMs: 30000
  requiredSelectors: []
  waitUntil: load
  scrollPage: true
  additionalWaitMs: 5000
  maxScreenshotHeight: 7000
  visualRegressionThreshold: 1.0
  generateDiffMask: true

pages:
  https://example.com/:
    requiredSelectors:
      - "nav"
      - "footer"
  
  https://example.com/about:
    # Uses defaults
```

### Settings

Configure via the web UI at `/settings`:

- **Scheduled Runs**: Enable/disable and set cron expression (default: 6 AM daily)
- **Retention Policies**:
  - Unpromoted runs: Deleted after N days (default: 7)
  - Baseline history: Keep last N baselines (default: 3)
- **Cleanup Schedule**: Cron for automatic cleanup (default: 3 AM daily)
- **Notifications**: Subscribe to run notifications (sent via Zapier)

## Data Storage

All data is stored in the `data/` directory:

```
data/
├── app.db                    # SQLite database
├── config/
│   ├── on-demand.yaml       # On-demand run config
│   └── scheduled.yaml       # Scheduled run config
└── screenshots/
    ├── runs/                # Run screenshots (cleaned per retention)
    │   └── run_xxx/
    └── baselines/           # Baseline screenshots
        └── baseline_xxx/
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/runs` | GET | List all runs |
| `/api/runs` | POST | Create new run |
| `/api/runs/[id]` | GET | Get run details |
| `/api/runs/[id]/promote` | POST | Promote run to baseline |
| `/api/runs/[id]/progress` | GET | SSE stream for run progress |
| `/api/baselines` | GET | List all baselines |
| `/api/baselines/[id]/restore` | POST | Restore baseline as current |
| `/api/config/on-demand` | GET/PUT | On-demand config |
| `/api/config/scheduled` | GET/PUT | Scheduled config |
| `/api/settings` | GET/PUT | App settings |
| `/api/settings/notifications` | GET/PUT | User notification prefs |
| `/api/cleanup/auto` | POST | Delete failed runs only |
| `/api/cleanup/full` | POST | Apply retention policies |
| `/api/screenshots/run/[id]/[...path]` | GET | Serve run screenshots |
| `/api/screenshots/baseline/[id]/[...path]` | GET | Serve baseline screenshots |

## Troubleshooting

### Playwright Issues

If screenshots fail, ensure Chromium is properly installed:

```bash
pnpm exec playwright install chromium --with-deps
```

### Database Issues

The SQLite database is auto-created on first run. To reset:

```bash
rm data/app.db
pnpm dev
```

### Authentication Issues

1. Verify `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set in `.env.local`
2. Ensure `NEXTAUTH_SECRET` is set
3. If you need to reset the admin password, delete the database (`rm data/app.db`) and restart the server
