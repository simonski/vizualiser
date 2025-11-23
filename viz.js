// viz.js - Year in Review Visualization
(async function() {
    'use strict';

    // Load configuration
    const config = await fetch('config.json').then(r => r.json());
    
    // Parse CSV and extract label from header
    async function loadCSV(filepath) {
        const response = await fetch(filepath);
        const text = await response.text();
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',');
        
        // Second column header is the label
        const label = headers[1] ? headers[1].trim() : 'Data';
        
        const data = lines.slice(1).map(line => {
            const values = line.split(',');
            const obj = {};
            headers.forEach((header, i) => {
                obj[header.trim()] = values[i].trim();
            });
            return obj;
        });
        
        return { data, label };
    }

    // Load all data sources
    const dataSets = await Promise.all(
        config.dataSources.map(async source => {
            const { data, label } = await loadCSV(source.file);
            return { ...source, data, label };
        })
    );
    
    // Load events if configured
    let eventSources = [];
    if (config.events && Array.isArray(config.events)) {
        eventSources = await Promise.all(
            config.events.map(async eventConfig => {
                const { data } = await loadCSV(eventConfig.file);
                const events = data.map(row => {
                    const dayIndex = Math.floor((new Date(row.date) - new Date(config.animation.startDate)) / (1000 * 60 * 60 * 24));
                    return {
                        date: row.date,
                        event: row.event,
                        dayIndex: dayIndex,
                        targetHeight: 0.5 + Math.random() * 0.5, // Random height between 50% and 100%
                        color: eventConfig.color
                    };
                });
                return { ...eventConfig, events };
            })
        );
    }

    // Setup Three.js scene
    const canvas = document.getElementById('viz-canvas');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.position.z = 50;
    
    // Mouse tracking for starfield parallax
    const mouse = { x: 0, y: 0 };
    window.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    // Date display
    const dateDisplay = document.getElementById('date-display');
    
    // Create legend
    const legendContainer = document.getElementById('legend');
    dataSets.forEach(dataSource => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        
        const colorBox = document.createElement('div');
        colorBox.className = 'legend-color';
        colorBox.style.backgroundColor = dataSource.color;
        colorBox.style.color = dataSource.color;
        
        const labelText = document.createElement('div');
        labelText.className = 'legend-label';
        labelText.textContent = dataSource.label;
        
        item.appendChild(colorBox);
        item.appendChild(labelText);
        legendContainer.appendChild(item);
    });
    
    // Add events to legend
    if (eventSources.length > 0) {
        // Add spacer
        const spacer = document.createElement('div');
        spacer.style.height = '20px';
        legendContainer.appendChild(spacer);
        
        eventSources.forEach(eventSource => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            colorBox.style.backgroundColor = eventSource.color;
            colorBox.style.color = eventSource.color;
            
            const labelText = document.createElement('div');
            labelText.className = 'legend-label';
            labelText.textContent = eventSource.label;
            
            item.appendChild(colorBox);
            item.appendChild(labelText);
            legendContainer.appendChild(item);
        });
    }

    // Create visualization geometry
    const chartWidth = 120;
    const chartHeight = 45;
    const maxDataPoints = 365;

    // Calculate global max value across all datasets for consistent scaling
    const globalMaxValue = Math.max(...dataSets.map(ds => 
        Math.max(...ds.data.map(d => parseFloat(d[Object.keys(d)[1]])))
    ));

    function createAnimatedLine(dataSource, exactDay) {
        const { data, color } = dataSource;
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.LineBasicMaterial({ 
            color: color || '#00ff88',
            linewidth: 2
        });
        
        const points = [];
        const currentDay = Math.floor(exactDay);
        const dayFraction = exactDay - currentDay;
        
        // Show all complete days
        const visibleData = data.slice(0, currentDay + 1);
        
        visibleData.forEach((point, i) => {
            const x = (i / data.length) * chartWidth - chartWidth / 2;
            const value = parseFloat(point[Object.keys(point)[1]]);
            const y = (value / globalMaxValue) * chartHeight - chartHeight / 2;
            points.push(new THREE.Vector3(x, y, 0));
        });
        
        // Interpolate to next point if we're partway through a day
        if (dayFraction > 0 && currentDay < data.length - 1) {
            const currentValue = parseFloat(data[currentDay][Object.keys(data[currentDay])[1]]);
            const nextValue = parseFloat(data[currentDay + 1][Object.keys(data[currentDay + 1])[1]]);
            
            // Linear interpolation
            const interpolatedValue = currentValue + (nextValue - currentValue) * dayFraction;
            
            const x = ((currentDay + dayFraction) / data.length) * chartWidth - chartWidth / 2;
            const y = (interpolatedValue / globalMaxValue) * chartHeight - chartHeight / 2;
            points.push(new THREE.Vector3(x, y, 0));
        }
        
        geometry.setFromPoints(points);
        return new THREE.Line(geometry, material);
    }

    // Create axes
    function createAxes() {
        const axesGroup = new THREE.Group();
        const axisMaterial = new THREE.LineBasicMaterial({ color: 0x444444 });
        
        // X axis
        const xAxisGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-chartWidth / 2, -chartHeight / 2, 0),
            new THREE.Vector3(chartWidth / 2, -chartHeight / 2, 0)
        ]);
        axesGroup.add(new THREE.Line(xAxisGeometry, axisMaterial));
        
        // Y axis
        const yAxisGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-chartWidth / 2, -chartHeight / 2, 0),
            new THREE.Vector3(-chartWidth / 2, chartHeight / 2, 0)
        ]);
        axesGroup.add(new THREE.Line(yAxisGeometry, axisMaterial));
        
        // Add month labels along x-axis
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthStarts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]; // Day of year for each month start
        const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        
        months.forEach((month, i) => {
            const dayOfYear = monthStarts[i];
            const monthMidpoint = dayOfYear + monthLengths[i] / 2; // Center of the month
            const x = (monthMidpoint / 365) * chartWidth - chartWidth / 2;
            const y = -chartHeight / 2 - 3; // Position below x-axis
            
            // Create text sprite for month label
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 128;
            canvas.height = 64;
            context.font = 'Bold 38px monospace'; // Increased from 32px (20% larger)
            context.fillStyle = '#666666';
            context.textAlign = 'center';
            context.fillText(month, 64, 40);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(x, y, 0);
            sprite.scale.set(4, 2, 1);
            axesGroup.add(sprite);
        });
        
        return axesGroup;
    }
    
    // Create event markers with fade-in animation (vertical lines with circles and text)
    function createEventMarkers(exactDay) {
        const group = new THREE.Group();
        const fadeInDays = 7; // Start fading in 7 days before event
        
        // Iterate through all event sources
        eventSources.forEach(eventSource => {
            const eventColor = eventSource.color;
            
            eventSource.events.forEach(event => {
                // Calculate fade-in progress using exact day (with fraction)
                const daysUntilEvent = event.dayIndex - exactDay;
            
            // Skip events that haven't started fading in yet
            if (daysUntilEvent > fadeInDays) return;
            
            // Calculate opacity (0 to 1 over fadeInDays)
            let opacity = 1;
            if (daysUntilEvent > 0) {
                opacity = 1 - (daysUntilEvent / fadeInDays);
            }
            
            // Calculate line growth (grows from 0 to targetHeight)
            let heightProgress = 1;
            if (daysUntilEvent > 0) {
                heightProgress = 1 - (daysUntilEvent / fadeInDays);
            }
            
            const x = (event.dayIndex / totalDays) * chartWidth - chartWidth / 2;
            const lineHeight = chartHeight * event.targetHeight * heightProgress;
            const yTop = lineHeight - chartHeight / 2;
            
            // Vertical line
            const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(x, -chartHeight / 2, 0),
                new THREE.Vector3(x, yTop, 0)
            ]);
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: eventColor,
                transparent: true,
                opacity: opacity
            });
            group.add(new THREE.Line(lineGeometry, lineMaterial));
            
            // Circle at top
            const circleGeometry = new THREE.CircleGeometry(0.5, 16);
            const circleMaterial = new THREE.MeshBasicMaterial({ 
                color: eventColor,
                transparent: true,
                opacity: opacity
            });
            const circle = new THREE.Mesh(circleGeometry, circleMaterial);
            circle.position.set(x, yTop, 0);
            group.add(circle);
            
            // Text label using canvas sprite
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 256;
            canvas.height = 64;
            context.font = 'Bold 48px monospace'; // Increased from 40px (20% larger)
            context.fillStyle = eventColor;
            context.globalAlpha = opacity;
            context.textAlign = 'center';
            context.fillText(event.event, 128, 40);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ 
                map: texture,
                transparent: true,
                opacity: opacity
            });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(x, yTop + 2, 0);
            sprite.scale.set(8, 2, 1);
            group.add(sprite);
            });
        });
        
        return group;
    }

    // Create starfield
    function createStarfield() {
        const starfield = new THREE.Group();
        const starfieldConfig = config.starfield || {};
        
        if (starfieldConfig.enabled === false) {
            return starfield;
        }
        
        const atomCount = starfieldConfig.atomCount || 200;
        const minRadius = starfieldConfig.minRadius || 0.05;
        const maxRadius = starfieldConfig.maxRadius || 0.3;
        const minOpacity = starfieldConfig.minOpacity || 0.1;
        const maxOpacity = starfieldConfig.maxOpacity || 0.6;
        
        for (let i = 0; i < atomCount; i++) {
            const radius = minRadius + Math.random() * (maxRadius - minRadius);
            const geometry = new THREE.SphereGeometry(radius, 8, 8);
            const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);
            const material = new THREE.MeshBasicMaterial({ 
                color: 0xffffff,
                transparent: true,
                opacity: opacity
            });
            const atom = new THREE.Mesh(geometry, material);
            
            // Position atoms in a wide area around the chart
            atom.position.x = (Math.random() - 0.5) * 150;
            atom.position.y = (Math.random() - 0.5) * 100;
            atom.position.z = (Math.random() - 0.5) * 100 - 20; // Behind the chart
            
            // Store original position for parallax effect
            atom.userData.originalPosition = atom.position.clone();
            
            starfield.add(atom);
        }
        
        return starfield;
    }
    
    // Add starfield and axes to scene
    const starfield = createStarfield();
    scene.add(starfield);
    scene.add(createAxes());

    // Animation state
    const startDate = new Date(config.animation.startDate);
    const endDate = new Date(config.animation.endDate);
    const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const totalDuration = config.animation.totalDurationSeconds || 60;
    const millisecondsPerDay = (totalDuration * 1000) / totalDays;
    
    let currentDay = 0;
    let animationStartTime = Date.now();
    let lastFrameTime = Date.now();
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    // Main animation loop - smooth continuous rendering at 30fps
    function animate() {
        requestAnimationFrame(animate);
        
        const now = Date.now();
        const deltaTime = now - lastFrameTime;
        
        // Throttle to 30fps
        if (deltaTime < frameInterval) {
            return;
        }
        lastFrameTime = now - (deltaTime % frameInterval);
        
        // Update starfield parallax based on mouse position (very subtle)
        if (starfield && config.starfield?.enabled !== false) {
            starfield.children.forEach(atom => {
                const parallaxStrength = 0.5; // Very subtle movement
                atom.position.x = atom.userData.originalPosition.x + mouse.x * parallaxStrength;
                atom.position.y = atom.userData.originalPosition.y + mouse.y * parallaxStrength;
            });
        }

        const elapsedTime = now - animationStartTime;

        // Calculate exact fractional day position for smooth interpolation
        const exactDay = Math.min(elapsedTime / millisecondsPerDay, totalDays - 1);
        const calculatedDay = Math.floor(exactDay);

        // Update date display when day changes
        if (calculatedDay !== currentDay && calculatedDay < totalDays) {
            currentDay = calculatedDay;
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + currentDay);
            dateDisplay.textContent = currentDate.toISOString().split('T')[0];
        }

        // Clear and redraw visualization every frame for smooth interpolation
        scene.children = scene.children.filter(child => {
            // Keep starfield (Group with Mesh children having originalPosition userData)
            if (child instanceof THREE.Group && child.children[0]?.userData?.originalPosition) {
                return true;
            }
            // Keep axes (Group with line children having 0x444444 color)
            if (child instanceof THREE.Group) {
                return child.children.some(c => c.material?.color?.getHex() === 0x444444);
            }
            return false;
        });

        // Re-add axes if not present
        if (!scene.children.some(child => child instanceof THREE.Group && child.children[0]?.material?.color?.getHex() === 0x444444)) {
            scene.add(createAxes());
        }

        // Add updated visualization for each data source with interpolation
        dataSets.forEach(dataSource => {
            const animatedLine = createAnimatedLine(dataSource, exactDay);
            scene.add(animatedLine);
        });
        
        // Add event markers with interpolated fade-in
        if (eventSources.length > 0) {
            const eventMarkers = createEventMarkers(exactDay);
            scene.add(eventMarkers);
        }

        renderer.render(scene, camera);
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Start animation
    animate();
})();
