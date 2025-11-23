// visualiser.js - Year in Review Visualization with Scene Support
(async function() {
    'use strict';

    // Load configuration
    const config = await fetch('config.json').then(r => r.json());
    
    // Set config in CardRegistry for border settings
    CardRegistry.setConfig(config);
    
    // Get canvas containers
    const canvasContainer = document.getElementById('infinite-canvas');
    const fixedUIContainer = document.getElementById('fixed-ui');
    
    // Load saved canvas state
    function loadCanvasState() {
        const saved = localStorage.getItem('canvas_transform');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                return {
                    panOffsetX: state.panOffsetX || 0,
                    panOffsetY: state.panOffsetY || 0,
                    zoomScale: state.zoomScale || 1.0
                };
            } catch (e) {
                console.error('Failed to load canvas state:', e);
            }
        }
        return { panOffsetX: 0, panOffsetY: 0, zoomScale: 1.0 };
    }
    
    // Save canvas state to localStorage
    function saveCanvasState() {
        const state = {
            panOffsetX,
            panOffsetY,
            zoomScale
        };
        localStorage.setItem('canvas_transform', JSON.stringify(state));
    }
    
    // Initialize canvas state from saved values
    const savedState = loadCanvasState();
    
    // Infinite canvas panning state
    let isPanning = false;
    let panLastX = 0;
    let panLastY = 0;
    let panOffsetX = savedState.panOffsetX;
    let panOffsetY = savedState.panOffsetY;
    let isShiftPressed = false;
    let isMouseDownOnCanvas = false;
    
    // Zoom state
    let zoomScale = savedState.zoomScale;
    const MIN_ZOOM = 0.1;
    const MAX_ZOOM = 10.0;
    const ZOOM_SENSITIVITY = 0.001;
    const ZOOM_TOUCH_SENSITIVITY = 0.01;
    
    // Touch gesture state
    let lastTouchDistance = null;
    let lastTouchMidX = null;
    let lastTouchMidY = null;
    
    // Apply current transform to canvas
    function updateCanvasTransform() {
        canvasContainer.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${zoomScale})`;
        
        // Update body background position to create infinite scrolling grid effect
        const bgX = panOffsetX;
        const bgY = panOffsetY;
        document.body.style.backgroundPosition = `${bgX}px ${bgY}px, ${bgX}px ${bgY}px, ${bgX}px ${bgY}px, ${bgX}px ${bgY}px`;
        
        // Update body background size based on zoom to keep grid spacing consistent
        const gridSize = 100 * zoomScale;
        const smallGridSize = 20 * zoomScale;
        document.body.style.backgroundSize = `${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px, ${smallGridSize}px ${smallGridSize}px, ${smallGridSize}px ${smallGridSize}px`;
        
        // Update CardRegistry with current transform for coordinate conversion
        CardRegistry.setCanvasTransform(panOffsetX, panOffsetY, zoomScale);
        
        // Save canvas state
        saveCanvasState();
    }
    
    // Track Shift key state
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift' && !isShiftPressed) {
            isShiftPressed = true;
            canvasContainer.style.cursor = 'grab';
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') {
            isShiftPressed = false;
            if (!isMouseDownOnCanvas) {
                canvasContainer.style.cursor = 'default';
            }
        }
    });
    
    // Mouse down on canvas background (not on cards) starts panning
    canvasContainer.addEventListener('mousedown', (e) => {
        // Only pan if clicking directly on the canvas (not on a card)
        if (e.target === canvasContainer) {
            isMouseDownOnCanvas = true;
            isPanning = true;
            panLastX = e.clientX;
            panLastY = e.clientY;
            canvasContainer.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isMouseDownOnCanvas) {
            isMouseDownOnCanvas = false;
            isPanning = false;
            canvasContainer.style.cursor = isShiftPressed ? 'grab' : 'default';
        }
    });
    
    // Canvas panning handlers - pan with Shift+move OR left mouse drag on canvas
    document.addEventListener('mousemove', (e) => {
        // Pan if Shift is pressed OR if mouse is down on canvas
        if (isShiftPressed || isPanning) {
            if (panLastX !== 0 || panLastY !== 0) {
                const deltaX = e.clientX - panLastX;
                const deltaY = e.clientY - panLastY;
                panOffsetX += deltaX;
                panOffsetY += deltaY;
                updateCanvasTransform();
            }
            panLastX = e.clientX;
            panLastY = e.clientY;
        } else {
            panLastX = 0;
            panLastY = 0;
        }
    });
    
    // Mouse wheel zoom - zoom centered on mouse position
    canvasContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // Get mouse position relative to viewport
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        // Calculate point in canvas space before zoom
        const canvasX = (mouseX - panOffsetX) / zoomScale;
        const canvasY = (mouseY - panOffsetY) / zoomScale;
        
        // Update zoom
        const zoomDelta = -e.deltaY * ZOOM_SENSITIVITY;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomScale + zoomDelta));
        
        // Adjust pan to keep the point under the mouse cursor in the same place
        panOffsetX = mouseX - canvasX * newZoom;
        panOffsetY = mouseY - canvasY * newZoom;
        
        zoomScale = newZoom;
        updateCanvasTransform();
    }, { passive: false });
    
    // Touch gesture handlers for pinch-to-zoom and two-finger pan
    canvasContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            // Two fingers - start gesture
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dx = touch2.clientX - touch1.clientX;
            const dy = touch2.clientY - touch1.clientY;
            lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
            lastTouchMidX = (touch1.clientX + touch2.clientX) / 2;
            lastTouchMidY = (touch1.clientY + touch2.clientY) / 2;
            e.preventDefault();
        }
    }, { passive: false });
    
    canvasContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && lastTouchDistance !== null) {
            // Two fingers - handle both zoom and pan
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dx = touch2.clientX - touch1.clientX;
            const dy = touch2.clientY - touch1.clientY;
            const currentDistance = Math.sqrt(dx * dx + dy * dy);
            
            // Calculate midpoint
            const currentMidX = (touch1.clientX + touch2.clientX) / 2;
            const currentMidY = (touch1.clientY + touch2.clientY) / 2;
            
            // Calculate distance change for zoom detection
            const distanceChange = Math.abs(currentDistance - lastTouchDistance);
            const ZOOM_THRESHOLD = 5; // Minimum distance change to trigger zoom
            
            if (distanceChange > ZOOM_THRESHOLD) {
                // Significant distance change - perform zoom
                const rect = canvasContainer.getBoundingClientRect();
                const midX = currentMidX - rect.left;
                const midY = currentMidY - rect.top;
                
                // Calculate point in canvas space before zoom
                const canvasX = (midX - panOffsetX) / zoomScale;
                const canvasY = (midY - panOffsetY) / zoomScale;
                
                // Update zoom based on distance change
                const zoomDelta = (currentDistance - lastTouchDistance) * ZOOM_TOUCH_SENSITIVITY;
                const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomScale + zoomDelta));
                
                // Adjust pan to keep pinch center in same place
                panOffsetX = midX - canvasX * newZoom;
                panOffsetY = midY - canvasY * newZoom;
                
                zoomScale = newZoom;
            } else {
                // Small or no distance change - perform pan
                const panDeltaX = currentMidX - lastTouchMidX;
                const panDeltaY = currentMidY - lastTouchMidY;
                panOffsetX += panDeltaX;
                panOffsetY += panDeltaY;
            }
            
            lastTouchDistance = currentDistance;
            lastTouchMidX = currentMidX;
            lastTouchMidY = currentMidY;
            updateCanvasTransform();
            e.preventDefault();
        }
    }, { passive: false });
    
    canvasContainer.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            // Less than two fingers - end gesture
            lastTouchDistance = null;
            lastTouchMidX = null;
            lastTouchMidY = null;
        }
    });
    
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

    // Scene class - encapsulates a visualization scene with one or more graphs
    class Scene {
        constructor(sceneConfig, _, __, config) {
            this.name = sceneConfig.name;
            this.title = sceneConfig.title;
            this.graphs = [];
            this.config = config;
            this.sceneConfig = sceneConfig;
            this.lastRenderedDay = -1;
            this.graphObjects = new Map(); // Cache for reusable Three.js objects
        }

        async init() {
            // Load data for all graphs in this scene
            for (const graphConfig of this.sceneConfig.graphs) {
                const graph = await this.createGraph(graphConfig);
                this.graphs.push(graph);
            }
            
            // Pre-create static objects that don't change
            this.createStaticObjects();
        }

        async createGraph(graphConfig) {
            // Load data sources
            const dataSets = await Promise.all(
                (graphConfig.dataSources || []).map(async source => {
                    const { data, label } = await loadCSV(source.file);
                    return { ...source, data, label };
                })
            );
            
            // Load events
            let eventSources = [];
            if (graphConfig.events && Array.isArray(graphConfig.events)) {
                eventSources = await Promise.all(
                    graphConfig.events.map(async eventConfig => {
                        const { data } = await loadCSV(eventConfig.file);
                        const events = data.map(row => {
                            const dayIndex = Math.floor((new Date(row.date) - new Date(this.config.animation.startDate)) / (1000 * 60 * 60 * 24));
                            return {
                                date: row.date,
                                event: row.event,
                                dayIndex: dayIndex,
                                targetHeight: 0.5 + Math.random() * 0.5,
                                color: eventConfig.color
                            };
                        });
                        return { ...eventConfig, events };
                    })
                );
            }

            // Convert world coordinates to screen pixels
            // World units are arbitrary, use a scale factor to convert to reasonable pixel sizes
            const worldToPixelScale = 10; // 1 world unit = 10 pixels
            const pixelWidth = graphConfig.position.width * worldToPixelScale;
            const pixelHeight = graphConfig.position.height * worldToPixelScale;
            
            // Calculate screen position (centering the world coordinate system)
            // World center is approximately at screen center
            const screenCenterX = window.innerWidth / 2;
            const screenCenterY = window.innerHeight / 2;
            const pixelX = screenCenterX + (graphConfig.position.x * worldToPixelScale) - (pixelWidth / 2);
            const pixelY = screenCenterY - (graphConfig.position.y * worldToPixelScale) - (pixelHeight / 2);
            
            // Create Card for this graph
            const graphCard = new Card(
                `graph_${this.name}_${graphConfig.name}`,
                graphConfig.title || graphConfig.name,
                { x: pixelX, y: pixelY },
                { width: pixelWidth, height: pixelHeight },
                true // resizable
            );
            
            // Create container for canvas and labels
            const graphContainer = document.createElement('div');
            graphContainer.style.display = 'flex';
            graphContainer.style.flexDirection = 'column';
            graphContainer.style.width = '100%';
            graphContainer.style.height = '100%';
            graphContainer.style.position = 'relative';
            
            // Create canvas for Three.js rendering
            const canvas = document.createElement('canvas');
            canvas.style.display = 'block';
            canvas.style.margin = '0';
            canvas.style.padding = '0';
            canvas.style.width = '100%';
            canvas.style.flex = '1'; // Fill available space minus labels
            
            // Create date labels container
            const dateLabelsContainer = document.createElement('div');
            dateLabelsContainer.style.display = 'flex';
            dateLabelsContainer.style.height = '20px';
            dateLabelsContainer.style.position = 'relative';
            dateLabelsContainer.style.fontSize = '10px';
            dateLabelsContainer.style.color = '#888';
            dateLabelsContainer.style.fontFamily = 'monospace';
            
            graphContainer.appendChild(canvas);
            graphContainer.appendChild(dateLabelsContainer);
            
            // Create Three.js renderer for this graph
            const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
            renderer.setClearColor(0x0a0a0a, 1); // Dark background
            renderer.autoClear = true;
            
            // Add graph container to card (includes canvas and labels)
            graphCard.setContentNoPadding(graphContainer);
            graphCard.appendTo(canvasContainer);
            // Initially hide the card - will be shown when scene is activated
            graphCard.hide();
            
            // Now that card is in DOM, get actual content size and set renderer size
            const headerHeight = 24;
            const dateLabelsHeight = 20;
            const actualCanvasWidth = graphCard.size.width;
            const actualCanvasHeight = graphCard.size.height - headerHeight - dateLabelsHeight;
            
            // Set canvas to explicit pixel size (not percentage)
            canvas.width = actualCanvasWidth;
            canvas.height = actualCanvasHeight;
            canvas.style.width = actualCanvasWidth + 'px';
            canvas.style.height = actualCanvasHeight + 'px';
            
            renderer.setSize(actualCanvasWidth, actualCanvasHeight, false); // false = don't set CSS size
            
            // Create camera for this graph - add padding so content doesn't touch edges
            const chartWidth = graphConfig.position.width;
            const chartHeight = graphConfig.position.height;
            const sidePadding = 0.05; // 5% padding on left/right/bottom
            const topPadding = 0.15; // 15% padding on top for more space
            const paddedWidth = chartWidth * (1 + sidePadding);
            const paddedHeight = chartHeight * (1 + sidePadding + topPadding);
            const verticalOffset = (topPadding - sidePadding) * chartHeight / 2;
            const camera = new THREE.OrthographicCamera(
                -paddedWidth / 2, paddedWidth / 2,
                paddedHeight / 2 - verticalOffset, -paddedHeight / 2 - verticalOffset,
                0.1, 1000
            );
            camera.position.z = 50;
            camera.lookAt(0, 0, 0);  // Point camera at origin
            
            // Calculate scaling parameters based on graph type
            const scaling = graphConfig.scaling || 'linear';
            let scalingParams = { type: scaling };
            
            if (scaling === 'normalized') {
                // Calculate min/max for each dataset for normalization
                scalingParams.ranges = dataSets.map(ds => {
                    const values = ds.data.map(d => parseFloat(d[Object.keys(d)[1]]));
                    return {
                        min: Math.min(...values),
                        max: Math.max(...values),
                        dataSource: ds
                    };
                });
                scalingParams.globalMaxValue = 100; // Normalized to 0-100%
            } else if (scaling === 'logarithmic') {
                // For log scale, find global min/max across all datasets
                const allValues = dataSets.flatMap(ds => 
                    ds.data.map(d => parseFloat(d[Object.keys(d)[1]]))
                ).filter(v => v > 0); // Remove zeros for log scale
                scalingParams.globalMin = Math.min(...allValues);
                scalingParams.globalMax = Math.max(...allValues);
                scalingParams.globalMaxValue = Math.log10(scalingParams.globalMax + 1);
            } else {
                // Linear scaling - use actual max value
                scalingParams.globalMaxValue = Math.max(...dataSets.map(ds => 
                    Math.max(...ds.data.map(d => parseFloat(d[Object.keys(d)[1]])))
                ));
            }
            
            return {
                name: graphConfig.name,
                title: graphConfig.title || graphConfig.name,
                position: graphConfig.position,
                dataSets,
                eventSources,
                chartWidth: graphConfig.position.width,
                chartHeight: graphConfig.position.height,
                globalMaxValue: scalingParams.globalMaxValue,
                scaling: scalingParams,
                card: graphCard,
                canvas: canvas,
                renderer: renderer,
                camera: camera,
                dateLabelsContainer: dateLabelsContainer,
                lastWidth: actualCanvasWidth,
                lastHeight: actualCanvasHeight
            };
        }

        createStaticObjects() {
            // Create static objects for each graph (axes and data lines)
            this.graphs.forEach(graph => {
                const graphGroup = new THREE.Group();
                graphGroup.userData.graphName = graph.name;
                graphGroup.userData.graphData = graph;
                
                // Graph is positioned at 0,0 in its own local space
                graphGroup.position.set(0, 0, 0);
                
                // Add static elements (axes only - title is now in Card header)
                graphGroup.add(this.createAxes(graph));
                
                // Create reusable line geometries and materials
                graph.lineObjects = [];
                graph.dataSets.forEach(dataSource => {
                    const geometry = new THREE.BufferGeometry();
                    const maxPoints = dataSource.data.length + 1;
                    const positions = new Float32Array(maxPoints * 3);
                    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                    geometry.setDrawRange(0, 0); // Start with no points
                    
                    const material = new THREE.LineBasicMaterial({ 
                        color: dataSource.color || '#00ff88',
                        linewidth: 2
                    });
                    const line = new THREE.Line(geometry, material);
                    line.userData.dataSource = dataSource;
                    line.userData.label = dataSource.label;
                    graphGroup.add(line);
                    graph.lineObjects.push(line);
                });
                
                // Create event marker group (will be updated each frame)
                graph.eventGroup = new THREE.Group();
                graphGroup.add(graph.eventGroup);
                
                // Store graphGroup for this graph
                this.graphObjects.set(graph.name, graphGroup);
            });
        }

        activate() {
            this.graphs.forEach(graph => {
                if (graph.card) {
                    graph.card.show();
                }
            });
        }

        deactivate() {
            this.graphs.forEach(graph => {
                if (graph.card) {
                    graph.card.hide();
                }
            });
        }

        updateLegend(legendContainer) {
            legendContainer.innerHTML = '';
            
            // Add title
            const title = document.createElement('div');
            title.style.fontSize = '20px';
            title.style.fontWeight = 'bold';
            title.style.marginBottom = '10px';
            title.textContent = this.title;
            legendContainer.appendChild(title);
            
            // Add metrics legends from all graphs
            this.graphs.forEach(graph => {
                graph.dataSets.forEach(dataSource => {
                    const item = document.createElement('div');
                    item.className = 'legend-item';
                    item.style.display = 'flex';
                    item.style.alignItems = 'center';
                    item.style.gap = '8px';
                    
                    // Toggle button
                    const isVisible = loadMetricVisibility(this.name, dataSource.label);
                    const toggleBtn = document.createElement('button');
                    toggleBtn.textContent = isVisible ? '×' : '○';
                    toggleBtn.style.width = '9px';
                    toggleBtn.style.height = '9px';
                    toggleBtn.style.padding = '0';
                    toggleBtn.style.border = '1px solid #00ff88';
                    toggleBtn.style.backgroundColor = isVisible ? '#00ff88' : '#222';
                    toggleBtn.style.color = isVisible ? '#000' : '#00ff88';
                    toggleBtn.style.cursor = 'pointer';
                    toggleBtn.style.borderRadius = '2px';
                    toggleBtn.style.fontSize = '8px';
                    toggleBtn.style.lineHeight = '7px';
                    toggleBtn.style.fontWeight = 'bold';
                    toggleBtn.title = isVisible ? 'Hide metric' : 'Show metric';
                    
                    toggleBtn.onclick = () => {
                        const newVisibility = !loadMetricVisibility(this.name, dataSource.label);
                        saveMetricVisibility(this.name, dataSource.label, newVisibility);
                        toggleBtn.textContent = newVisibility ? '×' : '○';
                        toggleBtn.style.backgroundColor = newVisibility ? '#00ff88' : '#222';
                        toggleBtn.style.color = newVisibility ? '#000' : '#00ff88';
                        toggleBtn.title = newVisibility ? 'Hide metric' : 'Show metric';
                        needsRender = true;
                    };
                    
                    const colorBox = document.createElement('div');
                    colorBox.className = 'legend-color';
                    colorBox.style.backgroundColor = dataSource.color;
                    colorBox.style.opacity = isVisible ? '1' : '0.3';
                    
                    const labelText = document.createElement('div');
                    labelText.className = 'legend-label';
                    labelText.textContent = dataSource.label;
                    labelText.style.opacity = isVisible ? '1' : '0.5';
                    
                    item.appendChild(toggleBtn);
                    item.appendChild(colorBox);
                    item.appendChild(labelText);
                    legendContainer.appendChild(item);
                });
                
                // Add events to legend
                if (graph.eventSources.length > 0) {
                    const spacer = document.createElement('div');
                    spacer.style.height = '20px';
                    legendContainer.appendChild(spacer);
                    
                    graph.eventSources.forEach(eventSource => {
                        const item = document.createElement('div');
                        item.className = 'legend-item';
                        item.style.display = 'flex';
                        item.style.alignItems = 'center';
                        item.style.gap = '8px';
                        
                        // Toggle button
                        const isVisible = loadMetricVisibility(this.name, eventSource.label);
                        const toggleBtn = document.createElement('button');
                        toggleBtn.textContent = isVisible ? '×' : '○';
                        toggleBtn.style.width = '9px';
                        toggleBtn.style.height = '9px';
                        toggleBtn.style.padding = '0';
                        toggleBtn.style.border = '1px solid #00ff88';
                        toggleBtn.style.backgroundColor = isVisible ? '#00ff88' : '#222';
                        toggleBtn.style.color = isVisible ? '#000' : '#00ff88';
                        toggleBtn.style.cursor = 'pointer';
                        toggleBtn.style.borderRadius = '2px';
                        toggleBtn.style.fontSize = '8px';
                        toggleBtn.style.lineHeight = '7px';
                        toggleBtn.style.fontWeight = 'bold';
                        toggleBtn.title = isVisible ? 'Hide events' : 'Show events';
                        
                        toggleBtn.onclick = () => {
                            const newVisibility = !loadMetricVisibility(this.name, eventSource.label);
                            saveMetricVisibility(this.name, eventSource.label, newVisibility);
                            toggleBtn.textContent = newVisibility ? '×' : '○';
                            toggleBtn.style.backgroundColor = newVisibility ? '#00ff88' : '#222';
                            toggleBtn.style.color = newVisibility ? '#000' : '#00ff88';
                            toggleBtn.title = newVisibility ? 'Hide events' : 'Show events';
                            needsRender = true;
                        };
                        
                        const colorBox = document.createElement('div');
                        colorBox.className = 'legend-color';
                        colorBox.style.backgroundColor = eventSource.color;
                        colorBox.style.opacity = isVisible ? '1' : '0.3';
                        
                        const labelText = document.createElement('div');
                        labelText.className = 'legend-label';
                        labelText.textContent = eventSource.label;
                        labelText.style.opacity = isVisible ? '1' : '0.5';
                        
                        item.appendChild(toggleBtn);
                        item.appendChild(colorBox);
                        item.appendChild(labelText);
                        legendContainer.appendChild(item);
                    });
                }
            });
        }

        render(exactDay, totalDays) {
            // Update and render each graph
            this.graphs.forEach(graph => {
                const graphGroup = this.graphObjects.get(graph.name);
                if (!graphGroup || !graph.card || !graph.renderer || !graph.camera) {
                    console.warn(`Skipping graph ${graph.name}: missing components`);
                    return;
                }
                
                // Skip if card is hidden
                if (graph.card.container.style.display === 'none') {
                    console.warn(`Skipping graph ${graph.name}: card hidden`);
                    return;
                }
                
                // Update renderer size if card was resized
                const headerHeight = 24;
                const dateLabelsHeight = 20;
                const currentWidth = graph.card.size.width;
                const currentHeight = graph.card.size.height - headerHeight - dateLabelsHeight;
                if (graph.lastWidth !== currentWidth || graph.lastHeight !== currentHeight) {
                    // Update canvas size
                    graph.canvas.width = currentWidth;
                    graph.canvas.height = currentHeight;
                    graph.canvas.style.width = currentWidth + 'px';
                    graph.canvas.style.height = currentHeight + 'px';
                    
                    graph.renderer.setSize(currentWidth, currentHeight, false);
                    // Camera frustum stays the same - always shows chartWidth x chartHeight
                    // Don't adjust based on canvas aspect ratio
                    graph.camera.updateProjectionMatrix();
                    graph.lastWidth = currentWidth;
                    graph.lastHeight = currentHeight;
                }
                
                // Update line geometries with new data (every frame for smooth interpolation)
                graph.lineObjects.forEach(line => {
                    const dataSource = line.userData.dataSource;
                    const isVisible = loadMetricVisibility(this.name, dataSource.label);
                    line.visible = isVisible;
                    
                    if (!isVisible) return;
                    
                    this.updateLineGeometry(line, dataSource, exactDay, graph);
                });
                
                // Create new event objects when day changes
                const currentDay = Math.floor(exactDay);
                if (currentDay !== this.lastRenderedDay) {
                    this.createNewEventObjects(graph, exactDay, totalDays);
                }
                
                // Update ALL event objects EVERY frame for smooth animation
                this.updateAllEventObjects(graph, exactDay);
                
                // Update date labels (throttled)
                this.updateDateLabels(graph, exactDay, totalDays);
                
                // Create a local Three.js scene for this graph
                const localScene = new THREE.Scene();
                // No scene background - let renderer clear color show
                localScene.add(graphGroup);
                

                
                // Render this graph in its own canvas
                graph.renderer.clear();
                graph.renderer.render(localScene, graph.camera);
            });
            
            this.lastRenderedDay = Math.floor(exactDay);
        }

        updateLineGeometry(line, dataSource, exactDay, graph) {
            const { data } = dataSource;
            const geometry = line.geometry;
            const positions = geometry.attributes.position.array;
            
            const currentDay = Math.floor(exactDay);
            const dayFraction = exactDay - currentDay;
            const visibleData = data.slice(0, currentDay + 1);
            
            let pointIndex = 0;
            visibleData.forEach((point, i) => {
                const x = (i / data.length) * graph.chartWidth - graph.chartWidth / 2;
                const value = parseFloat(point[Object.keys(point)[1]]);
                const y = (value / graph.globalMaxValue) * graph.chartHeight - graph.chartHeight / 2;
                
                positions[pointIndex * 3] = x;
                positions[pointIndex * 3 + 1] = y;
                positions[pointIndex * 3 + 2] = 0;
                pointIndex++;
            });
            
            // Interpolate the last point
            if (currentDay < data.length - 1 && dayFraction > 0) {
                const currentPoint = data[currentDay];
                const nextPoint = data[currentDay + 1];
                
                const currentValue = parseFloat(currentPoint[Object.keys(currentPoint)[1]]);
                const nextValue = parseFloat(nextPoint[Object.keys(nextPoint)[1]]);
                const interpolatedValue = currentValue + (nextValue - currentValue) * dayFraction;
                
                const x = ((currentDay + dayFraction) / data.length) * graph.chartWidth - graph.chartWidth / 2;
                const y = (interpolatedValue / graph.globalMaxValue) * graph.chartHeight - graph.chartHeight / 2;
                
                positions[pointIndex * 3] = x;
                positions[pointIndex * 3 + 1] = y;
                positions[pointIndex * 3 + 2] = 0;
                pointIndex++;
            }
            
            geometry.setDrawRange(0, pointIndex);
            geometry.attributes.position.needsUpdate = true;
        }
        
        createNewEventObjects(graph, exactDay, totalDays) {
            // Initialize event objects storage if needed
            if (!graph.eventObjects) {
                graph.eventObjects = [];
            }
            
            // Filter visible event sources
            const visibleEventSources = graph.eventSources.filter(eventSource => 
                loadMetricVisibility(this.name, eventSource.label)
            );
            
            // Create event objects that don't exist yet
            const fadeInDays = 7;
            visibleEventSources.forEach(eventSource => {
                eventSource.events.forEach(event => {
                    const eventKey = `${eventSource.label}_${event.dayIndex}`;
                    
                    // Check if already created
                    const existing = graph.eventObjects.find(e => e.key === eventKey);
                    if (existing) return;
                    
                    const daysUntilEvent = event.dayIndex - exactDay;
                    
                    // Only create events that are now visible (within fadeIn range)
                    if (daysUntilEvent <= fadeInDays) {
                        const eventObj = this.createEventObject(graph.eventGroup, event, eventSource, totalDays, graph);
                        eventObj.key = eventKey;
                        graph.eventObjects.push(eventObj);
                    }
                });
            });
        }
        
        updateDateLabels(graph, exactDay, totalDays) {
            const container = graph.dateLabelsContainer;
            if (!container) return;
            
            // Only update labels occasionally (every 5 days or so) to avoid constant DOM updates
            const daysSinceLastUpdate = Math.abs(exactDay - (graph.lastLabelUpdate || -100));
            if (daysSinceLastUpdate < 5 && graph.lastLabelUpdate !== undefined) return;
            
            graph.lastLabelUpdate = exactDay;
            container.innerHTML = '';
            
            // Get all data to find date range
            const firstDataSet = graph.dataSets[0];
            if (!firstDataSet || !firstDataSet.data.length) return;
            
            const startDate = new Date(firstDataSet.data[0].date);
            const endDate = new Date(firstDataSet.data[firstDataSet.data.length - 1].date);
            
            // Calculate number of months in the date range
            const startYear = startDate.getFullYear();
            const startMonth = startDate.getMonth();
            const endYear = endDate.getFullYear();
            const endMonth = endDate.getMonth();
            const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
            
            // Show label for each month
            for (let i = 0; i < totalMonths; i++) {
                const labelDate = new Date(startYear, startMonth + i, 1);
                const labelTime = labelDate.getTime();
                const fraction = (labelTime - startDate.getTime()) / (endDate.getTime() - startDate.getTime());
                
                const label = document.createElement('div');
                label.style.position = 'absolute';
                label.style.left = (fraction * 100) + '%';
                label.style.transform = 'translateX(-50%)';
                label.style.whiteSpace = 'nowrap';
                label.textContent = labelDate.toLocaleDateString('en-US', { month: 'short' });
                
                container.appendChild(label);
            }
        }
        
        updateAllEventObjects(graph, exactDay) {
            // Update all event objects every frame for smooth animation
            if (!graph.eventObjects) return;
            
            graph.eventObjects.forEach(eventObj => {
                this.updateEventObject(eventObj, exactDay, graph);
            });
        }

        // Transform value based on graph scaling type
        transformValue(value, dataSource, graph) {
            const scaling = graph.scaling;
            
            if (scaling.type === 'normalized') {
                // Find the range for this specific datasource
                const range = scaling.ranges.find(r => r.dataSource === dataSource);
                if (!range) return value;
                
                // Normalize to 0-100
                const normalized = ((value - range.min) / (range.max - range.min)) * 100;
                return normalized;
            } else if (scaling.type === 'logarithmic') {
                // Apply log10 transformation, handling zeros
                return value > 0 ? Math.log10(value + 1) : 0;
            }
            
            // Linear - return as-is
            return value;
        }

        createAnimatedLine(dataSource, exactDay, graph) {
            const { data, color } = dataSource;
            const geometry = new THREE.BufferGeometry();
            const material = new THREE.LineBasicMaterial({ 
                color: color || '#00ff88',
                linewidth: 2
            });
            
            const points = [];
            const currentDay = Math.floor(exactDay);
            const dayFraction = exactDay - currentDay;
            
            const visibleData = data.slice(0, currentDay + 1);
            
            visibleData.forEach((point, i) => {
                const x = (i / data.length) * graph.chartWidth - graph.chartWidth / 2;
                const rawValue = parseFloat(point[Object.keys(point)[1]]);
                const value = this.transformValue(rawValue, dataSource, graph);
                const y = (value / graph.globalMaxValue) * graph.chartHeight - graph.chartHeight / 2;
                points.push(new THREE.Vector3(x, y, 0));
            });
            
            if (dayFraction > 0 && currentDay < data.length - 1) {
                const currentRawValue = parseFloat(data[currentDay][Object.keys(data[currentDay])[1]]);
                const nextRawValue = parseFloat(data[currentDay + 1][Object.keys(data[currentDay + 1])[1]]);
                const interpolatedRawValue = currentRawValue + (nextRawValue - currentRawValue) * dayFraction;
                const interpolatedValue = this.transformValue(interpolatedRawValue, dataSource, graph);
                
                const x = ((currentDay + dayFraction) / data.length) * graph.chartWidth - graph.chartWidth / 2;
                const y = (interpolatedValue / graph.globalMaxValue) * graph.chartHeight - graph.chartHeight / 2;
                points.push(new THREE.Vector3(x, y, 0));
            }
            
            geometry.setFromPoints(points);
            return new THREE.Line(geometry, material);
        }

        createAxes(graph) {
            const axesGroup = new THREE.Group();
            const axisMaterial = new THREE.LineBasicMaterial({ color: 0x444444 }); // Subtle gray axes
            
            // X axis - centered horizontally at bottom
            const xAxisGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-graph.chartWidth / 2, -graph.chartHeight / 2, 0),
                new THREE.Vector3(graph.chartWidth / 2, -graph.chartHeight / 2, 0)
            ]);
            const xLine = new THREE.Line(xAxisGeometry, axisMaterial);
            axesGroup.add(xLine);
            
            // Y axis - centered vertically at left
            const yAxisGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-graph.chartWidth / 2, -graph.chartHeight / 2, 0),
                new THREE.Vector3(-graph.chartWidth / 2, graph.chartHeight / 2, 0)
            ]);
            const yLine = new THREE.Line(yAxisGeometry, axisMaterial);
            axesGroup.add(yLine);
            
            return axesGroup;
            
            // Add month labels
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthStarts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
            const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            
            months.forEach((month, i) => {
                const monthMidpoint = monthStarts[i] + monthLengths[i] / 2;
                const x = (monthMidpoint / 365) * graph.chartWidth - graph.chartWidth / 2;
                const y = -graph.chartHeight / 2 - 3;
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = 128;
                canvas.height = 64;
                context.font = 'Bold 38px monospace';
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

        createEventObject(targetGroup, event, eventSource, totalDays, graph) {
            const x = (event.dayIndex / totalDays) * graph.chartWidth - graph.chartWidth / 2;
            
            // Create line with updatable geometry
            const lineGeometry = new THREE.BufferGeometry();
            const linePositions = new Float32Array(6); // 2 points * 3 coords
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: event.color,
                transparent: true,
                opacity: 0
            });
            const line = new THREE.Line(lineGeometry, lineMaterial);
            targetGroup.add(line);
            
            // Create circle
            const circleGeometry = new THREE.CircleGeometry(0.5, 16);
            const circleMaterial = new THREE.MeshBasicMaterial({ 
                color: event.color,
                transparent: true,
                opacity: 0
            });
            const circle = new THREE.Mesh(circleGeometry, circleMaterial);
            targetGroup.add(circle);
            
            // Create text sprite
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 256;
            canvas.height = 64;
            context.font = 'Bold 48px monospace';
            context.fillStyle = event.color;
            context.textAlign = 'center';
            context.fillText(event.event, 128, 40);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ 
                map: texture,
                transparent: true,
                opacity: 0
            });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(8, 2, 1);
            targetGroup.add(sprite);
            
            return {
                event,
                eventSource,
                x,
                line,
                lineMaterial,
                linePositions,
                circle,
                circleMaterial,
                sprite,
                spriteMaterial,
                chartHeight: graph.chartHeight,
                actualY: 0, // Track actual Y position for overlap detection
                textWidth: 8, // Sprite width
                textHeight: 2  // Sprite height
            };
        }
        
        updateEventObject(eventObj, exactDay, graph) {
            const fadeInDays = 7;
            const daysUntilEvent = eventObj.event.dayIndex - exactDay;
            
            // Calculate smooth opacity
            let opacity = 1;
            if (daysUntilEvent > 0) {
                opacity = 1 - (daysUntilEvent / fadeInDays);
            }
            opacity = Math.max(0, Math.min(1, opacity));
            
            // Calculate smooth height progress
            let heightProgress = 1;
            if (daysUntilEvent > 0) {
                heightProgress = 1 - (daysUntilEvent / fadeInDays);
            }
            
            // Calculate base target height
            let targetHeight = eventObj.event.targetHeight;
            
            // Check for overlaps with other visible events and adjust height if needed
            if (graph.eventObjects) {
                const overlapCheckRadius = 1; // Circle radius
                const textPadding = 0.5; // Extra padding for text
                
                // Sort by day index to check only previous events
                const previousEvents = graph.eventObjects
                    .filter(other => 
                        other !== eventObj && 
                        other.event.dayIndex <= eventObj.event.dayIndex &&
                        other.actualY > 0 // Only check events that are visible
                    )
                    .sort((a, b) => a.event.dayIndex - b.event.dayIndex);
                
                for (const other of previousEvents) {
                    const xDistance = Math.abs(eventObj.x - other.x);
                    const yDistance = Math.abs(
                        eventObj.chartHeight * targetHeight - other.actualY
                    );
                    
                    // Check if circles overlap
                    const circleOverlap = xDistance < overlapCheckRadius * 2 && 
                                         yDistance < overlapCheckRadius * 2;
                    
                    // Check if text overlaps (text is positioned above circle)
                    const textOverlap = xDistance < (eventObj.textWidth / 2 + other.textWidth / 2) &&
                                       Math.abs(
                                           (eventObj.chartHeight * targetHeight + 2) - 
                                           (other.actualY + 2)
                                       ) < (eventObj.textHeight + textPadding);
                    
                    if (circleOverlap || textOverlap) {
                        // Adjust target height to be above the overlapping event
                        const requiredHeight = (other.actualY / eventObj.chartHeight) + 
                                              (textOverlap ? 0.15 : 0.08);
                        targetHeight = Math.max(targetHeight, requiredHeight);
                        // Clamp to reasonable values
                        targetHeight = Math.min(targetHeight, 0.95);
                    }
                }
            }
            
            const lineHeight = eventObj.chartHeight * targetHeight * heightProgress;
            const yTop = lineHeight - eventObj.chartHeight / 2;
            
            // Store actual Y position for future overlap checks
            eventObj.actualY = lineHeight;
            
            // Update line geometry
            eventObj.linePositions[0] = eventObj.x;
            eventObj.linePositions[1] = -eventObj.chartHeight / 2;
            eventObj.linePositions[2] = 0;
            eventObj.linePositions[3] = eventObj.x;
            eventObj.linePositions[4] = yTop;
            eventObj.linePositions[5] = 0;
            eventObj.line.geometry.attributes.position.needsUpdate = true;
            
            // Update materials
            eventObj.lineMaterial.opacity = opacity;
            eventObj.circleMaterial.opacity = opacity;
            eventObj.spriteMaterial.opacity = opacity;
            
            // Update positions
            eventObj.circle.position.set(eventObj.x, yTop, 0);
            eventObj.sprite.position.set(eventObj.x, yTop + 2, 0);
        }
    }

    // Visibility persistence functions
    function saveMetricVisibility(sceneName, metricLabel, isVisible) {
        const key = `metric_visibility_${sceneName}_${metricLabel}`;
        localStorage.setItem(key, JSON.stringify(isVisible));
    }
    
    function loadMetricVisibility(sceneName, metricLabel) {
        const key = `metric_visibility_${sceneName}_${metricLabel}`;
        const saved = localStorage.getItem(key);
        return saved !== null ? JSON.parse(saved) : true; // default: visible
    }

    // Initialize all scenes
    const scenes = [];
    for (const sceneConfig of config.scenes) {
        const scene = new Scene(sceneConfig, null, null, config);
        await scene.init();
        scenes.push(scene);
    }

    // Scene management
    let currentSceneIndex = 0;
    let currentScene = scenes[currentSceneIndex];
    
    // Activate first scene
    scenes.forEach((s, i) => {
        if (i === currentSceneIndex) {
            s.activate();
        } else {
            s.deactivate();
        }
    });

    // UI Elements
    
    // Create Legend Card (resizable)
    const legendCard = new Card('legend', 'Legend', { x: 20, y: 250 }, { width: 250, height: 320 }, true);
    const legendContent = document.createElement('div');
    legendCard.setContent(legendContent);
    legendCard.appendTo(canvasContainer);
    legendCard.show();
    
    // Update legend for current scene
    currentScene.updateLegend(legendContent);
    
    // Create Scene Picker Card with Date and Playback Controls (resizable)
    const scenePickerCard = new Card('scene-picker', 'Scene & Playback', { x: 20, y: 20 }, { width: 250, height: 180 }, true);
    
    const scenePickerContent = document.createElement('div');
    
    // Date display
    const dateDisplay = document.createElement('div');
    dateDisplay.id = 'date-display-card';
    dateDisplay.style.color = '#00ff88';
    dateDisplay.style.fontSize = '20px';
    dateDisplay.style.fontWeight = 'bold';
    dateDisplay.style.textAlign = 'center';
    dateDisplay.style.marginBottom = '10px';
    dateDisplay.style.textShadow = '0 0 10px rgba(0, 255, 136, 0.5)';
    scenePickerContent.appendChild(dateDisplay);
    
    // Scene selector (only if multiple scenes)
    if (scenes.length > 1) {
        const sceneSelector = document.createElement('select');
        sceneSelector.id = 'scene-selector';
        sceneSelector.style.width = '100%';
        sceneSelector.style.padding = '8px 12px';
        sceneSelector.style.backgroundColor = '#222';
        sceneSelector.style.color = '#00ff88';
        sceneSelector.style.border = '2px solid #00ff88';
        sceneSelector.style.borderRadius = '4px';
        sceneSelector.style.fontFamily = 'monospace';
        sceneSelector.style.fontSize = '14px';
        sceneSelector.style.cursor = 'pointer';
        sceneSelector.style.outline = 'none';
        sceneSelector.style.marginBottom = '10px';
        
        scenes.forEach((scene, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = scene.title;
            option.selected = index === currentSceneIndex;
            sceneSelector.appendChild(option);
        });
        
        sceneSelector.onchange = (e) => switchScene(parseInt(e.target.value));
        scenePickerContent.appendChild(sceneSelector);
    }
    
    // Playback controls
    const controlsContainer = document.createElement('div');
    controlsContainer.style.display = 'flex';
    controlsContainer.style.gap = '8px';
    controlsContainer.style.justifyContent = 'center';
    
    const rewindBtn = document.createElement('button');
    rewindBtn.textContent = '⏮';
    rewindBtn.title = 'Rewind to start';
    styleControlButton(rewindBtn);
    rewindBtn.onclick = () => rewindAnimation();
    
    const playPauseBtn = document.createElement('button');
    playPauseBtn.id = 'play-pause-btn';
    playPauseBtn.textContent = '⏸';
    playPauseBtn.title = 'Pause/Play';
    styleControlButton(playPauseBtn);
    playPauseBtn.onclick = () => togglePlayPause();
    
    controlsContainer.appendChild(rewindBtn);
    controlsContainer.appendChild(playPauseBtn);
    scenePickerContent.appendChild(controlsContainer);
    
    scenePickerCard.setContent(scenePickerContent);
    scenePickerCard.appendTo(canvasContainer);
    scenePickerCard.show();
    
    function styleControlButton(btn) {
        btn.style.padding = '6px 10px';
        btn.style.backgroundColor = '#222';
        btn.style.color = '#00ff88';
        btn.style.border = '2px solid #00ff88';
        btn.style.borderRadius = '4px';
        btn.style.fontFamily = 'monospace';
        btn.style.fontSize = '16px';
        btn.style.cursor = 'pointer';
        btn.style.outline = 'none';
        btn.style.minWidth = '40px';
    }

    function switchScene(index) {
        if (index === currentSceneIndex) return;
        
        // Deactivate current scene
        currentScene.deactivate();
        
        // Activate new scene
        currentSceneIndex = index;
        currentScene = scenes[currentSceneIndex];
        currentScene.activate();
        currentScene.updateLegend(legendContent);
        
        // Update selector
        const selector = document.getElementById('scene-selector');
        if (selector) {
            selector.value = index;
        }
        
        needsRender = true;
        // Don't reset animation - keep playing from current position
    }

    // Animation state
    const startDate = new Date(config.animation.startDate);
    const endDate = new Date(config.animation.endDate);
    const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const totalDuration = config.animation.totalDurationSeconds || 60;
    const millisecondsPerDay = (totalDuration * 1000) / totalDays;
    
    let currentDay = 0;
    let animationStartTime = Date.now();
    let pausedTime = 0;
    let isPaused = false;
    let lastFrameTime = Date.now();
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;
    let needsRender = true;
    let isAnimationComplete = false;
    
    function togglePlayPause() {
        const btn = document.getElementById('play-pause-btn');
        if (isPaused) {
            // Resume
            isPaused = false;
            isAnimationComplete = false;
            animationStartTime = Date.now() - pausedTime;
            btn.textContent = '⏸';
            btn.title = 'Pause';
            needsRender = true;
        } else {
            // Pause
            isPaused = true;
            pausedTime = Date.now() - animationStartTime;
            btn.textContent = '▶';
            btn.title = 'Play';
        }
    }
    
    function rewindAnimation() {
        animationStartTime = Date.now();
        pausedTime = 0;
        currentDay = 0;
        isAnimationComplete = false;
        needsRender = true;
        if (isPaused) {
            togglePlayPause();
        }
    }

    // Main animation loop
    function animate() {
        requestAnimationFrame(animate);
        
        const now = Date.now();
        const deltaTime = now - lastFrameTime;
        
        // Frame throttling
        if (deltaTime < frameInterval) {
            return;
        }
        lastFrameTime = now - (deltaTime % frameInterval);

        // Calculate current day based on pause state
        let elapsedTime;
        if (isPaused) {
            elapsedTime = pausedTime;
        } else {
            elapsedTime = now - animationStartTime;
        }
        
        const exactDay = Math.min(elapsedTime / millisecondsPerDay, totalDays - 1);
        const calculatedDay = Math.floor(exactDay);

        if (calculatedDay !== currentDay && calculatedDay < totalDays) {
            currentDay = calculatedDay;
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + currentDay);
            dateDisplay.textContent = currentDate.toISOString().split('T')[0];
        }
        
        // Check if animation is complete
        const wasComplete = isAnimationComplete;
        if (exactDay >= totalDays - 1 && !isPaused) {
            isAnimationComplete = true;
        }
        
        // Only skip rendering if paused AND complete
        if (isAnimationComplete && isPaused && !needsRender) {
            return;
        }

        // Render current scene (every frame for smooth interpolation)
        currentScene.render(exactDay, totalDays);

        needsRender = false;
    }

    // Start animation
    animate();
    
    // Apply initial canvas transform from saved state
    updateCanvasTransform();
    
    // Log all card positions on load
    console.log('📍 Card Positions:');
    CardRegistry.getAll().forEach(card => {
        console.log(`  ${card.id}: x=${card.position.x}, y=${card.position.y}`);
    });
    
    // Space bar controls: pause/play and triple-press reset
    let spacePressTimes = [];
    const triplePressDuration = 500; // ms window for triple press
    
    // Z key: toggle zoom to show all cards
    let isShowingAllCards = false;
    let savedZoomState = null;
    let zoomAnimationFrame = null;
    let zoomAnimationStart = null;
    const ZOOM_ANIMATION_DURATION = 1000; // ms
    
    function calculateBoundsOfAllCards() {
        const cards = CardRegistry.getAll();
        if (cards.length === 0) {
            return null;
        }
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        cards.forEach(card => {
            const bounds = card.getBounds();
            minX = Math.min(minX, bounds.left);
            minY = Math.min(minY, bounds.top);
            maxX = Math.max(maxX, bounds.right);
            maxY = Math.max(maxY, bounds.bottom);
        });
        
        return {
            left: minX,
            top: minY,
            right: maxX,
            bottom: maxY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }
    
    function animateZoom(fromState, toState) {
        if (zoomAnimationFrame) {
            cancelAnimationFrame(zoomAnimationFrame);
        }
        
        zoomAnimationStart = Date.now();
        
        function animate() {
            const elapsed = Date.now() - zoomAnimationStart;
            const progress = Math.min(elapsed / ZOOM_ANIMATION_DURATION, 1);
            
            // Ease in-out cubic
            const t = progress < 0.5 
                ? 4 * progress * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            // Interpolate zoom and pan
            panOffsetX = fromState.panOffsetX + (toState.panOffsetX - fromState.panOffsetX) * t;
            panOffsetY = fromState.panOffsetY + (toState.panOffsetY - fromState.panOffsetY) * t;
            zoomScale = fromState.zoomScale + (toState.zoomScale - fromState.zoomScale) * t;
            
            updateCanvasTransform();
            
            if (progress < 1) {
                zoomAnimationFrame = requestAnimationFrame(animate);
            } else {
                zoomAnimationFrame = null;
            }
        }
        
        animate();
    }
    
    function toggleShowAllCards() {
        if (isShowingAllCards) {
            // Zoom back to saved state
            if (savedZoomState) {
                const fromState = {
                    panOffsetX,
                    panOffsetY,
                    zoomScale
                };
                animateZoom(fromState, savedZoomState);
                isShowingAllCards = false;
                savedZoomState = null;
            }
        } else {
            // Save current state and zoom to show all cards
            savedZoomState = {
                panOffsetX,
                panOffsetY,
                zoomScale
            };
            
            const bounds = calculateBoundsOfAllCards();
            if (!bounds) return;
            
            // Add padding around cards
            const padding = 50;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Calculate zoom to fit all cards with padding
            const requiredWidth = bounds.width + padding * 2;
            const requiredHeight = bounds.height + padding * 2;
            const zoomX = viewportWidth / requiredWidth;
            const zoomY = viewportHeight / requiredHeight;
            const newZoom = Math.min(zoomX, zoomY, MAX_ZOOM);
            
            // Calculate pan to center all cards
            const newPanX = (viewportWidth / 2) - (bounds.centerX * newZoom);
            const newPanY = (viewportHeight / 2) - (bounds.centerY * newZoom);
            
            const fromState = {
                panOffsetX,
                panOffsetY,
                zoomScale
            };
            const toState = {
                panOffsetX: newPanX,
                panOffsetY: newPanY,
                zoomScale: newZoom
            };
            
            animateZoom(fromState, toState);
            isShowingAllCards = true;
        }
    }
    
    document.addEventListener('keydown', (e) => {
        // Z key: toggle show all cards
        if (e.code === 'KeyZ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            toggleShowAllCards();
            return;
        }
        
        // Only handle space bar, and ignore if user is typing in an input
        if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault(); // Prevent page scroll
            
            const now = Date.now();
            spacePressTimes.push(now);
            
            // Keep only recent presses within the triple-press window
            spacePressTimes = spacePressTimes.filter(time => now - time < triplePressDuration);
            
            if (spacePressTimes.length >= 3) {
                // Triple press: reset and play
                console.log('⏮️ Triple space press: Reset timeline');
                rewindAnimation();
                spacePressTimes = []; // Clear press history
            } else {
                // Single press: toggle pause/play
                togglePlayPause();
            }
        }
    });
    
    // Cheat code: IDKFA - reset all saved state
    let keySequence = '';
    const cheatCode = 'idkfa';
    const cornifyCode = 'iddqd';
    document.addEventListener('keypress', (e) => {
        keySequence += e.key.toLowerCase();
        if (keySequence.length > Math.max(cheatCode.length, cornifyCode.length)) {
            keySequence = keySequence.slice(-Math.max(cheatCode.length, cornifyCode.length));
        }
        if (keySequence.endsWith(cheatCode)) {
            console.log('🎮 IDKFA activated! Resetting all saved state...');
            localStorage.clear();
            location.reload();
        }
        if (keySequence.endsWith(cornifyCode)) {
            console.log('🦄 IDDQD activated! God mode: Unicorns and rainbows!');
            if (typeof cornify_add === 'function') {
                cornify_add();
            }
        }
    });
})();
