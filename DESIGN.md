DESIGN_PRODUCT.md

- the project name is `visualiser`

This is a bare-bones website that uses minimal html, css and javascript to visualise in a fullscreen webpage metrics over a year.  It's a year in review tool that animates metrics using lines and bar charts.

It should use threejs and include all dependencies locally.

The data should be a .csv file(s) that are also held locally, downloaded then rendered.

When the user loads the page it should start at Jan 1st and run through every day until Dec 31.  The whole animation should take 60 seconds.  

The html, css and javascript once complete should then read the .csv files via a config.json file which points to all the data files.

Don't use react or vite or node.  Minimal dependencies.  Just use the smallest set, threejs for example.

# Layout

A give page should have a rudimentary layout - one or more graphs as rectangles which can be arranged in the config.json.   Each different page is called a Scene.   Each scene is then available via a mouse click to load and animate different scenes.

We will start with a single scene that contains a single graph into which all metrics, enents are visualised.

# Metrics

Create an example csv dataset - e.g. commits per day and create a demo.

Create a make file that runs it via Caddy

Allow for multple data csv files.  the header of the CSV file shoudl contain the short title which will be displayed on the right in a legend.  Each data csv will be rendered in a different colour.

Create three more data csvs.

## Animation

The animation should be smooth; the new datapoints and metrics arrive on a schedule however the rendering should be continuous, not jerky.

# Events

Events are data points that occur throughout the year.  For example, releases, outages, people arriving.   The json should refer multiple events files.

The events have their own legend on the right hand side below the metrics.

## Event Animations

An event is represened as a vertical line from y-0 to between 50% and 100% of the y-axis with a silver circle and the text of the release above the circle.

The colour is specified in the json.

As the timeline approaches a new event, start to render the event smoothly fading in and drawing the line from y-0 up to the target point which should arrive on the day the event occurs.  In this way the human viewer should see a continuous stream of metrics and with say a weeks anticipation they shoudl see an event "fade into" existence until the timeline passes it by and hte event remains on the screen.

note the event should remain fixed at it's y-position, not animate up and down.

## Release Events

Create a release events .csv which will display on a given day an english language event

Put in between 0 and 2 events per month representing released, named R2025-NN where NN is the incrementing release title.   

Colour these silver.

## Outage events

Create 2 or three outage events (outage_events.csv) through the year, colour them red.  Name them "outage N"

## Milestone events

Create 4 or 5 milestone events in gold, name them MN where N is an ascending number 1..N

## Atoms and Starfield

Surrounding the graph shoudl be a subtle starfield where the atoms are of varying radius and luminescence.  They shoudl be subtle and noninvasive.  If the user moves the mouse, the whole starfield should move as if we were looking through a frustrum, however the amoutn of movement shoudl be very, very small.

The starfield should be toggleable on/off via the config.json.

## Graph

Render each month along the x axis, centred.