# UK Flood Monitoring Map

An interactive web map visualizing real-time flood monitoring data from the UK Environment Agency. This application displays monitoring stations, active flood warnings, and flood warning areas across England.

![UK Flood Monitoring Map](https://img.shields.io/badge/status-active-success)
![No Authentication Required](https://img.shields.io/badge/auth-none-blue)
![License](https://img.shields.io/badge/license-OGL-green)

## Features

- **Real-time Data**: Live flood warnings and monitoring station data
- **Interactive Map**: Click on markers and areas to see detailed information
- **Multiple Layers**: Toggle between different datasets:
  - 📍 Monitoring Stations (water level and flow measurement points)
  - ⚠️ Flood Warnings (current warnings by severity level)
  - 🗺️ Flood Warning Areas (geographic boundaries)
- **High Performance**: Optimized data fetching with parallel API calls
- **GeoJSON Format**: Efficient geographic data format for smooth map interactions
- **Responsive Design**: Works on desktop and mobile devices
- **No API Key Required**: Uses open government data

## Data Sources

All data comes from the **Environment Agency Real-time Flood Monitoring API**:

| Dataset | Endpoint | Description |
|---------|----------|-------------|
| Monitoring Stations | `/id/stations` | Water level and flow monitoring stations across England |
| Flood Warnings | `/id/floods` | Active flood warnings and alerts with severity levels |
| Flood Areas | `/id/floodAreas` | Geographic polygons showing flood warning area boundaries |

**API Base URL**: `https://environment.data.gov.uk/flood-monitoring`

**Documentation**: https://environment.data.gov.uk/flood-monitoring/doc/reference

## Severity Levels

Flood warnings are color-coded by severity:

- 🔴 **Severe Flood Warning** (Level 1): Danger to life, act immediately
- 🟠 **Flood Warning** (Level 2): Flooding is expected, immediate action required
- 🟡 **Flood Alert** (Level 3): Flooding is possible, be prepared

## Quick Start

### Option 1: Open Directly in Browser

Simply open `index.html` in a modern web browser. No build process or dependencies required.

### Option 2: Local Web Server

For best results, serve the files through a local web server:

```bash
# Using Python 3
python3 -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js (http-server)
npx http-server -p 8000

# Using PHP
php -S localhost:8000
```

Then open http://localhost:8000 in your browser.

### Option 3: Live Server (VS Code)

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

## Technical Details

### Architecture

- **Frontend Only**: Pure client-side application, no backend required
- **Map Library**: Leaflet.js v1.9.4 (lightweight, mobile-friendly)
- **Data Format**: GeoJSON for optimal map performance
- **API Calls**: Asynchronous parallel fetching for fast load times
- **Performance**: All layers typically load in < 5 seconds

### File Structure

```
gov-api-datasets/
├── index.html          # Main HTML file with map container
├── app.js              # JavaScript application logic
└── README.md           # This file
```

### Browser Compatibility

- Chrome/Edge: ✅ Fully supported
- Firefox: ✅ Fully supported
- Safari: ✅ Fully supported
- Mobile browsers: ✅ Fully supported

### Performance Optimizations

1. **Parallel API Requests**: All three endpoints are fetched simultaneously using `Promise.all()`
2. **GeoJSON Format**: Efficient geographic data format native to Leaflet
3. **Marker Clustering**: Considers clustering for large datasets (can be enabled if needed)
4. **Lazy Popups**: Popup content generated on-click, not on load
5. **CDN Resources**: Leaflet loaded from fast CDN

## How It Works

### Data Flow

1. **Fetch**: Application fetches data from three EA API endpoints in parallel
2. **Transform**: Raw API responses converted to GeoJSON format
3. **Visualize**: GeoJSON features rendered on map with appropriate styling
4. **Interact**: Users can click markers/areas for detailed information

### Data Transformation Examples

**Stations** (Point features):
```javascript
{
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { name, riverName, town, catchment, status }
}
```

**Flood Warnings** (Point features):
```javascript
{
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { areaName, severity, description, timeRaised }
}
```

**Flood Areas** (Polygon features):
```javascript
{
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [...] },
  properties: { label, riverOrSea, county }
}
```

## API Information

### Rate Limits

The Environment Agency API is open and does not require authentication. There are no published rate limits, but please use responsibly.

### Data Updates

- **Flood Warnings**: Updated every 15 minutes
- **Monitoring Stations**: Real-time (updated as data is received)
- **Flood Areas**: Static boundary data

### Attribution

As required by the Open Government Licence, this application includes the following attribution:

> "This uses Environment Agency flood and river level data from the real-time data API (Beta)"

## Customization

### Adding More Endpoints

The EA API provides additional endpoints you can integrate:

```javascript
// Add to ENDPOINTS object in app.js
measures: `${API_BASE}/id/measures`,
readings: `${API_BASE}/data/readings`
```

### Changing Map Center

Edit the initial view in `app.js`:

```javascript
// Current: Centered on England
map = L.map('map').setView([52.8, -1.5], 6);

// Example: Centered on London
map = L.map('map').setView([51.5074, -0.1278], 10);
```

### Styling Markers

Modify the marker styles in the `createStationsLayer`, `createFloodsLayer`, and `createFloodAreasLayer` functions.

## Troubleshooting

### Issue: Map not loading
- **Solution**: Check browser console for errors. Ensure you have internet connectivity (Leaflet and API require network access).

### Issue: No data showing
- **Solution**: The API may be temporarily down or your network may be blocking requests. Check the console for API errors.

### Issue: CORS errors
- **Solution**: Serve the files through a local web server rather than opening the HTML file directly (file:// protocol).

### Issue: Slow loading
- **Solution**: The API might be slow or returning large datasets. The application will show loading progress. Typical load time is 2-5 seconds.

## License

This project uses open government data licensed under the [Open Government Licence v3.0](http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).

The code in this repository is provided as-is for educational and demonstration purposes.

## Resources

- [Environment Agency Flood Monitoring API Documentation](https://environment.data.gov.uk/flood-monitoring/doc/reference)
- [Leaflet Documentation](https://leafletjs.com/reference.html)
- [GeoJSON Specification](https://geojson.org/)
- [Open Government Licence](http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/)

## Credits

- **Data Provider**: Environment Agency (UK)
- **Map Library**: Leaflet.js
- **Base Map Tiles**: OpenStreetMap contributors
- **API**: Environment Agency Real-time Flood Monitoring API (Beta)

---

**Note**: This is a demonstration application. For production use, consider adding error handling, retry logic, caching, and monitoring.
