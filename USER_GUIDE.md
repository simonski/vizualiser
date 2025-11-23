# viz - User Guide

## Overview

viz is a year-in-review visualization tool that animates your yearly metrics in real-time. The entire year progresses in 60 seconds, creating a smooth, rapid journey through your data.

## Getting Started

### Installation

No installation required! Just ensure you have Caddy web server installed:

```bash
# macOS
brew install caddy

# Linux (Debian/Ubuntu)
sudo apt install caddy

# Or download from https://caddyserver.com/
```

### Running viz

1. Navigate to the viz directory
2. Run `make run`
3. Open http://localhost:8080 in your browser
4. Watch the visualization animate from Jan 1 to Dec 31

### Stopping viz

Press `Ctrl+C` in the terminal or run `make stop`

## Using Your Own Data

### Step 1: Prepare Your CSV

Create a CSV file with your data in the `data/` directory:

```csv
date,metric_name
2025-01-01,value1
2025-01-02,value2
...
```

**Requirements:**
- First column must be `date` in YYYY-MM-DD format
- Include one row for each day of the year
- Additional columns can contain any numeric metrics

### Step 2: Update config.json

Add your data source to `config.json`:

```json
{
  "dataSources": [
    {
      "name": "my_metric",
      "file": "data/my_data.csv",
      "type": "line",
      "color": "#ff0088"
    }
  ],
  "events": {
    "file": "data/events.csv",
    "color": "#c0c0c0"
  },
  "animation": {
    "startDate": "2025-01-01",
    "endDate": "2025-12-31",
    "totalDurationSeconds": 60
  },
  "starfield": {
    "enabled": true,
    "atomCount": 200,
    "minRadius": 0.05,
    "maxRadius": 0.3,
    "minOpacity": 0.1,
    "maxOpacity": 0.6
  }
}
```

**Data Source Options:**
- `name`: Internal identifier
- `file`: Path to CSV file (relative to project root)
- `type`: Visualization type (`line` or `bar`)
- `color`: Hex color code for the visualization

**Note:** Labels are automatically extracted from CSV column headers and displayed in the legend.

**Events Options:**
- `file`: Path to events CSV file (format: date,event)
- `color`: Hex color for event markers (default: silver)

**Starfield Options:**
- `enabled`: Toggle starfield on/off
- `atomCount`: Number of background atoms (default: 200)
- `minRadius`/`maxRadius`: Size range for atoms
- `minOpacity`/`maxOpacity`: Luminescence range

### Step 3: Refresh

Reload the page in your browser to see your new data visualized.

## Use Cases

### 1. Development Metrics
Track daily commits, pull requests, code reviews, or bug fixes throughout the year.

**Example CSV:**
```csv
date,commits,prs,bugs_fixed
2025-01-01,5,2,3
2025-01-02,8,1,4
...
```

### 2. Personal Analytics
Monitor habits like steps walked, hours exercised, or pages read.

**Example CSV:**
```csv
date,steps,exercise_minutes,pages_read
2025-01-01,8500,30,25
2025-01-02,10200,45,30
...
```

### 3. Business Metrics
Visualize sales, customer acquisitions, or website traffic.

**Example CSV:**
```csv
date,sales,new_customers,visits
2025-01-01,1250,15,420
2025-01-02,1340,18,450
...
```

### 4. Project Progress
Show task completions, milestones reached, or hours logged.

**Example CSV:**
```csv
date,tasks_completed,hours_worked
2025-01-01,12,8
2025-01-02,15,9
...
```

## Customization

### Animation Speed

Adjust `totalDurationSeconds` in `config.json`:

```json
"animation": {
  "totalDurationSeconds": 120  // Entire year takes 120 seconds instead of 60
}
```

### Date Range

Modify `startDate` and `endDate`:

```json
"animation": {
  "startDate": "2025-06-01",
  "endDate": "2025-12-31",  // Show only half the year
  "totalDurationSeconds": 60
}
```

### Colors

Each data source can have its own color:

```json
{
  "color": "#00ff88"  // Bright green
}
```

Popular color options:
- `#00ff88` - Bright green (default)
- `#ff0088` - Bright pink
- `#0088ff` - Bright blue
- `#ffaa00` - Orange
- `#aa00ff` - Purple

## Troubleshooting

### The page is blank
- Check browser console (F12) for errors
- Verify `libs/three.min.js` exists
- Ensure CSV file path in `config.json` is correct

### Data not showing
- Confirm CSV has correct date format (YYYY-MM-DD)
- Verify date range matches config.json
- Check that CSV has numeric values

### Animation not progressing
- Refresh the page to restart
- Check that `totalDurationSeconds` is set in config.json

### Caddy won't start
- Ensure port 8080 is not in use
- Try `make stop` first to kill any existing process
- Verify Caddy is installed: `caddy version`

## Tips

1. **Multiple Metrics**: Add multiple data sources to `config.json` to visualize several metrics simultaneously
2. **Data Preparation**: Use spreadsheet software to create and validate your CSV before using it
3. **Testing**: Start with a short date range while testing your data
4. **Performance**: Keep data points reasonable (365 days works well)

## Technical Details

- **Framework**: Plain JavaScript with Three.js
- **Browser Support**: Modern browsers with WebGL support
- **Resolution**: Automatically scales to fullscreen
- **File Size**: Minimal (~650KB for Three.js)

## Next Steps

- Create your own CSV data files
- Experiment with different colors and visualization types
- Share your year-in-review with others
- Customize the styling in `style.css` for your brand
