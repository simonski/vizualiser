# viz - Year in Review Visualization

A minimal web-based visualization tool that animates yearly metrics day-by-day using Three.js.

## What is viz?

viz is a bare-bones year-in-review tool that displays data metrics in a fullscreen webpage. It animates through an entire year (Jan 1 - Dec 31) with each day advancing every second, visualizing data using line and bar charts rendered with Three.js.

## Features

- **Minimal Dependencies**: Uses only Three.js for 3D rendering - no React, Vite, or Node.js
- **Self-Contained**: All dependencies stored locally
- **Multiple Data Sources**: Display up to 4 different metrics simultaneously with color-coded legend
- **CSV Data**: Reads data from CSV files configured via `config.json`
- **Smooth Animation**: Interpolated rendering at 30fps for fluid progression through the year
- **Event Markers**: Release events fade in 7 days before occurring with vertical lines and labels
- **Starfield Background**: Subtle animated background with mouse parallax effect
- **Month Labels**: X-axis labeled with month abbreviations
- **Fullscreen Display**: Designed for immersive data presentation

## Quick Start

### Prerequisites

- [Caddy](https://caddyserver.com/) web server

### Running the Visualization

```bash
make run
```

Then open your browser to [http://localhost:8080](http://localhost:8080)

The visualization will automatically start on January 1st and progress through the year.

### Stopping the Server

```bash
make stop
```

## Project Structure

```
.
├── index.html          # Main HTML page
├── style.css           # Minimal fullscreen styling
├── viz.js              # Visualization logic
├── config.json         # Configuration (data sources, animation settings)
├── libs/               # Local dependencies
│   └── three.min.js    # Three.js library
├── data/               # CSV data files
│   └── commits.csv     # Example: daily commit data
├── Makefile            # Build and run commands
└── README.md           # This file
```

## Configuration

Edit `config.json` to customize data sources and animation:

```json
{
  "dataSources": [
    {
      "name": "commits",
      "file": "data/commits.csv",
      "type": "line",
      "color": "#00ff88",
      "label": "Daily Commits"
    }
  ],
  "animation": {
    "startDate": "2025-01-01",
    "endDate": "2025-12-31",
    "totalDurationSeconds": 60
  }
}
```

## Data Format

CSV files should have a `date` column and at least one metric column:

```csv
date,commits
2025-01-01,5
2025-01-02,8
...
```

## Available Commands

```bash
make          # Show help
make build    # Verify dependencies
make run      # Start Caddy server
make stop     # Stop Caddy server
make clean    # Remove temporary files
make test     # Run tests (placeholder)
```

## Development

The project follows a git workflow:
- `feature/*` branches for new features
- `develop` branch for integration
- `main` branch for stable releases

All code should pass tests before merging to develop.

## License

See project repository for license information.
