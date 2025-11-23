# Performance Analysis & Recommendations

## Critical Issues Identified

### 1. **Object Recreation Every Frame** (SEVERE)
**Current behavior:**
- `render()` method called 30 times per second
- Every frame: deletes ALL Three.js objects and creates NEW ones
- Creates hundreds of objects per frame:
  - BufferGeometry (lines, axes, events)
  - Materials (LineBasicMaterial, MeshBasicMaterial)
  - Meshes, Sprites, Groups
  - Canvas textures for text labels

**Impact:**
- Massive garbage collection pressure
- Chrome freezes during GC pauses
- High CPU usage even when paused
- Memory allocation/deallocation churn

**Solution:**
Create objects ONCE, update geometry attributes instead of recreating

### 2. **Canvas Texture Recreation** (HIGH)
**Current behavior:**
- Creates new canvas element every frame for each:
  - Graph title
  - Month labels
  - Event labels (up to 31 events)
- Each canvas triggers texture upload to GPU

**Impact:**
- GPU memory thrashing
- Slow canvas 2D context creation
- Texture upload bottleneck

**Solution:**
- Cache canvas textures
- Only recreate when content changes
- Use texture atlas for repeated labels

### 3. **Inefficient Geometry Updates** (MEDIUM)
**Current behavior:**
- Creates new BufferGeometry for animated lines each frame
- Allocates new Vector3 arrays
- Reallocates buffer attributes

**Solution:**
- Reuse BufferGeometry
- Update position attributes in place
- Use `geometry.attributes.position.needsUpdate = true`

### 4. **Legend DOM Reconstruction** (LOW)
**Current behavior:**
- Rebuilds entire legend HTML on scene switch
- Recreates all toggle buttons and event handlers

**Solution:**
- Build legend once, toggle visibility
- Reuse DOM elements

## Performance Optimization Plan

### Phase 1: Critical Fixes (Immediate)
1. **Object Pooling Pattern**
   - Create Three.js objects once during init
   - Store in scene graph with visibility flags
   - Update positions/attributes instead of recreating

2. **Geometry Attribute Updates**
   ```javascript
   // Instead of:
   const geometry = new THREE.BufferGeometry();
   geometry.setFromPoints(points);
   
   // Do:
   const positions = geometry.attributes.position.array;
   for (let i = 0; i < points.length; i++) {
       positions[i * 3] = points[i].x;
       positions[i * 3 + 1] = points[i].y;
       positions[i * 3 + 2] = points[i].z;
   }
   geometry.attributes.position.needsUpdate = true;
   ```

3. **Conditional Rendering**
   - Only call render() when data changes
   - Track `lastRenderedDay` to avoid redundant renders
   - Already have `needsRender` flag but still recreating objects

### Phase 2: Moderate Improvements
1. **Texture Caching**
   - Cache month label textures (12 total)
   - Cache event label textures
   - Cache graph titles

2. **Material Reuse**
   - Share materials across objects with same color
   - Create material library once

3. **Reduce Draw Calls**
   - Merge geometries where possible
   - Use instanced rendering for events

### Phase 3: Advanced Optimizations
1. **WebGL Rendering**
   - Use shader materials for better performance
   - Custom shaders for line interpolation

2. **Level of Detail (LOD)**
   - Reduce vertex count when zoomed out
   - Simplify event rendering

3. **Worker Threads**
   - Calculate data points in web worker
   - Main thread only handles rendering

## Immediate Action Items

### Quick Wins (< 1 hour):
1. ✅ Add `lastRenderedDay` check to skip redundant renders
2. ✅ Move static object creation out of render loop
3. ✅ Reuse geometry buffers with attribute updates
4. ✅ Cache graph titles and axes (they never change)

### Expected Improvements:
- **90% reduction** in object creation
- **75% reduction** in garbage collection
- **Smooth 60fps** rendering during drag
- **Near-zero CPU** when paused/complete

## Code Changes Required

1. **Scene Class Constructor**: Pre-create all geometries and materials
2. **render() Method**: Update existing objects instead of creating new
3. **Animation Loop**: Only render when day actually changes
4. **Texture Management**: Add texture cache with Map object

## Testing Recommendations

1. Chrome DevTools Performance profiler
2. Check "Rendering" > "Frame Rendering Stats"
3. Monitor Memory allocation timeline
4. Verify GC pauses eliminated during animation
5. Test with 4+ graphs in detailed view
