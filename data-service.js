// Shared Data Service for UK Hazard Map
const DataService = {
    API_BASE: 'https://environment.data.gov.uk/flood-monitoring',
    BGS_API_BASE: 'https://ogcapi.bgs.ac.uk',
    NRW_API_BASE: 'https://api.naturalresources.wales',

    // Keys provided by user
    NRW_KEY_RISK: '0cafca090ba64df0b7e23e8981fdd6b8',     // 5-day Flood Risk
    NRW_KEY_WARNINGS: '9bde0e2e74944c6181b84b9186754039', // Live Flood Warnings
    NRW_KEY_STATIONS: '2e3263c9bda642fdbd3d4a058af61b6d', // River Levels/Stations

    ENDPOINTS: {
        stations: 'https://environment.data.gov.uk/flood-monitoring/id/stations',
        floods: 'https://environment.data.gov.uk/flood-monitoring/id/floods',
        floodAreas: 'https://environment.data.gov.uk/flood-monitoring/id/floodAreas',
        landslides: 'https://ogcapi.bgs.ac.uk/collections/landslideindex/items?f=json&limit=5000',
        localAuthorities: 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LAD_MAY_2025_UK_BGC_V2/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson',
        nrwAreasAtRisk: 'https://api.naturalresources.wales/floodforecast/v2/areasatrisk',
        nrwFloodWarnings: 'https://api.naturalresources.wales/floodwarnings/v3/distance',
        nrwStationData: 'https://api.naturalresources.wales/rivers-and-seas/v1/api/StationData/historical'
    },

    // Fetch generic data
    async fetchData(url, name) {
        console.log(`Fetching ${name}...`);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data.items || [];
        } catch (error) {
            console.error(`Error fetching ${name}:`, error);
            return [];
        }
    },

    // Fetch data from NRW API with API Key header
    async fetchNRWData(url, name, key) {
        console.log(`Fetching ${name}...`);
        try {
            const response = await fetch(url, {
                headers: {
                    'Ocp-Apim-Subscription-Key': key
                }
            });

            if (response.status === 401 || response.status === 403) {
                console.warn(`NRW API Unauthorized for ${name}. Please check API Key in data-service.js`);
                return null;
            }

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Error fetching ${name}:`, error);
            return null;
        }
    },

    // Specific fetch functions
    async fetchStations() {
        return this.fetchData(this.ENDPOINTS.stations, 'Monitoring Stations');
    },

    async fetchFloods() {
        return this.fetchData(this.ENDPOINTS.floods, 'Flood Warnings');
    },

    async fetchFloodAreas() {
        return this.fetchData(this.ENDPOINTS.floodAreas, 'Flood Areas');
    },

    async fetchLandslides() {
        console.log('Fetching BGS Landslides...');
        try {
            const response = await fetch(this.ENDPOINTS.landslides);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data.features || [];
        } catch (error) {
            console.error('Error fetching BGS Landslides:', error);
            return [];
        }
    },

    // NRW Specific Fetchers
    async fetchNRWFloodAreas() {
        // GET /floodforecast/v2/areasatrisk
        // Use Risk Key
        return this.fetchNRWData(this.ENDPOINTS.nrwAreasAtRisk, 'NRW Flood Risk Areas', this.NRW_KEY_RISK) || [];
    },

    async fetchNRWWarnings(lat, lon, distance = 5000) {
        // GET /floodwarnings/v3/distance/{distance}/latlon/{lat}/{lon}
        // Use Warnings Key
        const url = `${this.ENDPOINTS.nrwFloodWarnings}/${distance}/latlon/${lat}/${lon}`;
        return this.fetchNRWData(url, 'NRW Flood Warnings', this.NRW_KEY_WARNINGS) || [];
    },

    async fetchNRWStationHistory(location, parameter = 'level') {
        // GET /rivers-and-seas/v1/api/StationData/historical?location={location}&parameter={parameter}
        // Use Stations Key
        const url = `${this.ENDPOINTS.nrwStationData}?location=${encodeURIComponent(location)}&parameter=${encodeURIComponent(parameter)}`;
        return this.fetchNRWData(url, 'NRW Station Data', this.NRW_KEY_STATIONS) || [];
    },

    // Utility to calculate distance between two coords (Haversine formula)
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of Earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    },

    // Geocode location using Nominatim
    async geocodeLocation(query) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=gb&limit=1`;
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'UKHazardMap/1.0' }
            });
            if (!response.ok) throw new Error('Geocoding failed');
            const data = await response.json();
            return data.length > 0 ? data[0] : null;
        } catch (error) {
            console.error('Geocoding error:', error);
            return null;
        }
    }
};
