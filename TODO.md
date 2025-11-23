# TODO

## Completed Tasks

### Initial Setup
- [x] Create feature branch `feature/initial-viz-implementation`
- [x] Download Three.js library to `libs/` directory
- [x] Create `config.json` configuration file
- [x] Create `Makefile` with build, run, stop, clean, test targets
- [x] Configure Caddy server integration
- [x] Create documentation (README.md, USER_GUIDE.md, TODO.md)

### Core Visualization
- [x] Implement `index.html` with minimal structure
- [x] Implement `style.css` with fullscreen styling
- [x] Implement `viz.js` with Three.js visualization logic
  - [x] CSV parsing functionality with label extraction from headers
  - [x] Animated line chart rendering
  - [x] Date display overlay (top-left)
  - [x] 60 second total animation (entire year)
  - [x] Auto-play from Jan 1 to Dec 31
  - [x] Smooth 30fps rendering with interpolation between data points

### Multiple Data Sources
- [x] Create sample `commits.csv` with full year 2025 data
- [x] Create `pull_requests.csv` sample data
- [x] Create `issues_closed.csv` sample data
- [x] Create `code_reviews.csv` sample data
- [x] Multi-dataset support in viz.js
- [x] Legend display (top-right) with color-coded labels
- [x] Global max value scaling for consistent y-axis
- [x] Replaced all 0 values with averages of adjacent values

### Events Feature
- [x] Create `release_events.csv` with 23 release events (R2025-01 to R2025-23)
- [x] Create `outage_events.csv` with 3 red outage events
- [x] Create `milestone_events.csv` with 5 gold milestone events (M1-M5)
- [x] Event visualization as vertical lines with different colors
- [x] Circles at event line tops
- [x] Event text labels above circles
- [x] Smooth fade-in animation starting 7 days before event
- [x] Line growth animation from y=0 to target height
- [x] Events remain fixed at y-position (no bouncing)
- [x] Events legend below metrics legend
- [x] Multiple event types support

### Starfield Background
- [x] Subtle starfield with 200 atoms
- [x] Varying atom sizes (0.05-0.3 radius)
- [x] Varying luminescence (0.1-0.6 opacity)
- [x] Mouse parallax effect (very subtle movement)
- [x] Starfield positioned behind chart
- [x] Toggleable via config.json

### Visual Enhancements
- [x] Increased graph size by 50% (80→120 width, 30→45 height)
- [x] Month labels along x-axis centered on each month
- [x] Font sizes increased by 20% (months: 38px, events: 48px)
- [x] Axes with proper styling

## Tasks In Progress

None

## Upcoming Tasks

### New Layout/Scenes Feature (from DESIGN.md update)
- [ ] Implement Scene concept - separate pages with different visualizations
- [ ] Add scene configuration to config.json
- [ ] Support multiple graphs per scene with configurable layout
- [ ] Add mouse click navigation between scenes
- [ ] Start with single scene containing single graph (current implementation)

### Testing
- [ ] Create unit tests for CSV parsing
- [ ] Create integration tests for visualization
- [ ] Test with different browsers (Chrome, Firefox, Safari)
- [ ] Test on different screen sizes
- [ ] Performance testing with large datasets

### Features to Consider
- [ ] Add bar chart visualization option
- [ ] Support for multiple simultaneous data series
- [ ] Add axis labels and gridlines
- [ ] Add play/pause controls
- [ ] Add speed adjustment controls
- [ ] Add date scrubber/timeline
- [ ] Export animation as video
- [ ] Screenshot/snapshot functionality
- [ ] Add legend for multiple data sources

### Code Quality
- [ ] Add JSDoc comments to viz.js
- [ ] Implement error handling for missing files
- [ ] Add data validation for CSV files
- [ ] Handle edge cases (missing days, invalid dates)

### Documentation
- [ ] Add troubleshooting section to USER_GUIDE.md
- [ ] Create examples directory with sample datasets
- [ ] Add animated GIF demo to README.md
- [ ] Document browser compatibility

### Git Workflow
- [ ] Run test suite (once implemented)
- [ ] Merge feature branch to develop
- [ ] Tag release version
- [ ] Merge develop to main

## Known Issues

None yet - awaiting initial testing

## Notes

- Project uses minimal dependencies as specified in DESIGN.md
- No React, Vite, or Node.js - just plain HTML/CSS/JS
- Three.js is the only external library
- All files are local (no CDN dependencies)
- Caddy server chosen for simplicity
