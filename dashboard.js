document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('locationInput');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');

    // Debounce search input
    let timeout = null;
    input.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            const query = e.target.value.trim();
            if (query.length > 2) {
                performSearch(query);
            }
        }, 800);
    });

    async function performSearch(query) {
        loading.style.display = 'block';
        results.style.display = 'none';

        // 1. Geocode
        const location = await DataService.geocodeLocation(query);

        if (!location) {
            loading.innerText = "Location not found.";
            return;
        }

        const lat = parseFloat(location.lat);
        const lon = parseFloat(location.lon);

        // 2. Fetch All Data
        // Includes floodAreas for polygon lookup
        const [stations, floods, floodAreas, landslides, nrwWarnings, bgsSensors] = await Promise.all([
            DataService.fetchStations(),
            DataService.fetchFloods(),
            DataService.fetchFloodAreas(),
            DataService.fetchLandslides(),
            DataService.fetchNRWWarnings(lat, lon, 10000), // 10km radius for NRW
            DataService.fetchBGSSensors()
        ]);

        // Create Area Lookup
        const areaMap = new Map();
        if (floodAreas) {
            floodAreas.forEach(area => {
                if (area['@id'] && area.polygon) {
                    areaMap.set(area['@id'], area.polygon);
                    if (area.floodAreaID) areaMap.set(area.floodAreaID, area.polygon);
                }
            });
        }

        // 3. Filter Data (Radius: 10km)
        const RADIUS_KM = 10;

        const nearbyStations = stations.filter(s => {
            if (!s.lat || !s.long) return false;
            return DataService.calculateDistance(lat, lon, s.lat, s.long) <= RADIUS_KM;
        });

        const nearbySensors = bgsSensors.filter(s => {
            // Extract location: Things(1)/Locations[0]
            const location = s.Locations && s.Locations.length > 0 ? s.Locations[0].location : null;
            if (!location || location.type !== 'Point') return false;

            const [lonS, latS] = location.coordinates;
            return DataService.calculateDistance(lat, lon, latS, lonS) <= RADIUS_KM;
        });

        // Strict spatial filtering for Floods (EA)
        const nearbyFloods = floods.filter(f => {
            // 1. Check if it has direct lat/long
            if (f.lat && f.long) {
                return DataService.calculateDistance(lat, lon, f.lat, f.long) <= RADIUS_KM;
            }

            // 2. Check if it has a floodArea polygon (embedded or lookup)
            let polygon = f.floodArea ? f.floodArea.polygon : null;

            // If embedded polygon is just a URL, try lookup
            if (!polygon || (typeof polygon === 'string' && !polygon.startsWith('POLYGON'))) {
                const areaID = f.floodArea ? f.floodArea['@id'] : f.floodAreaID;
                polygon = areaMap.get(areaID);
            }

            if (polygon && typeof polygon === 'string') {
                const coords = DataService.extractPolygonCoordinates(polygon);
                const centroid = DataService.calculateCentroid(coords);
                if (centroid) {
                    // Centroid is [lon, lat]
                    return DataService.calculateDistance(lat, lon, centroid[1], centroid[0]) <= RADIUS_KM;
                }
            }

            return false;
        });

        const nearbyLandslides = landslides.filter(l => {
            if (l.geometry && l.geometry.type === 'Point') {
                const [lLon, lLat] = l.geometry.coordinates;
                return DataService.calculateDistance(lat, lon, lLat, lLon) <= RADIUS_KM;
            }
            return false;
        });

        // 4. Update UI
        updateUI(nearbyStations, nearbyFloods, nearbyLandslides, nrwWarnings, nearbySensors);

        loading.style.display = 'none';
        results.style.display = 'grid';
    }

    function updateUI(stations, localFloods, landslides, nrwWarnings, sensors) {
        // Stations
        document.getElementById('stationCount').innerText = stations.length;
        const stationList = document.getElementById('stationList');
        stationList.innerHTML = stations.length === 0 ? '<li class="list-item">No stations nearby.</li>' :
            stations.map(s => `<li class="list-item"><strong>${s.label}</strong><br><small>${s.riverName || 'Unknown River'}</small></li>`).join('');

        // Landslides
        document.getElementById('landslideCount').innerText = landslides.length;
        const landslideList = document.getElementById('landslideList');
        landslideList.innerHTML = landslides.length === 0 ? '<li class="list-item">No records found.</li>' :
            landslides.map(l => {
                const year = l.properties.last_known_date_year;
                const dateDisplay = (year && year !== 'UNKNOWN') ? `Year: ${year}` : 'Date Unknown';
                return `<li class="list-item">
                    <strong>${l.properties.landslide_name || 'Landslide'}</strong><br>
                    <small>${dateDisplay} • ${l.properties.locality_details || 'No location details'}</small>
                </li>`;
            }).join('');

        // BGS Sensors
        document.getElementById('sensorCount').innerText = sensors.length;
        const sensorList = document.getElementById('sensorList');
        sensorList.innerHTML = sensors.length === 0 ? '<li class="list-item">No sensors nearby.</li>' :
            sensors.map(s => {
                let readings = '';
                if (s.Datastreams && s.Datastreams.length > 0) {
                    s.Datastreams.slice(0, 3).forEach(ds => { // Limit to 3 displayed metrics
                        const latestObs = ds.Observations && ds.Observations.length > 0 ? ds.Observations[0] : null;
                        if (latestObs) {
                            readings += `<span class="tag tag-warning" style="background:#f3e5f5; color:#7b1fa2; font-size:10px; margin-right:4px;">${ds.name.split(' ').pop()}: ${parseFloat(latestObs.result).toFixed(1)} ${ds.unitOfMeasurement?.symbol || ''}</span> `
                        }
                    });
                }
                return `<li class="list-item"><strong>${s.name}</strong><br>${readings}</li>`
            }).join('');


        // Floods (EA + NRW) - STRICTLY LOCAL ONLY
        let floodContent = '';
        let count = 0;

        // Add NRW Warnings
        if (nrwWarnings && nrwWarnings.length > 0) {
            count += nrwWarnings.length;
            floodContent += `<li class="list-item" style="background: #e0f7fa;"><strong>Found ${nrwWarnings.length} local NRW warnings</strong></li>`;
            nrwWarnings.forEach(w => {
                floodContent += `<li class="list-item"><strong>${w.description || 'NRW Warning'}</strong><br><small>${w.severity || 'Unknown severity'}</small></li>`;
            });
        }

        // Add Local EA Warnings
        if (localFloods.length > 0) {
            count += localFloods.length;
            floodContent += localFloods.map(f => {
                const tagClass = f.severityLevel === 1 ? 'tag-severe' : 'tag-warning';
                const tagText = f.severityLevel === 1 ? 'SEVERE' : 'WARNING';
                return `<li class="list-item">
                    <strong>${f.eaAreaName}</strong> <span class="tag ${tagClass}">${tagText}</span><br>
                    <small>${f.message || 'No details'}</small>
                </li>`;
            }).join('');
        }

        if (count === 0) {
            floodContent = '<li class="list-item">No active flood alerts in this area.</li>';
        }

        document.getElementById('floodCount').innerText = count;
        // Update label to reflect strictly local data
        document.querySelector('.card:first-child p').innerText = "Active alerts within 10km";

        const floodList = document.getElementById('floodList');
        floodList.innerHTML = floodContent;
    }
});
