import axios from 'axios';

// Weather tool implementation
const weatherTool = async (city) => {
  try {
    // Use Open-Meteo Geocoding API
    const geoResponse = await axios.get(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );

    if (!geoResponse.data.results || geoResponse.data.results.length === 0) {
      return { error: `City "${city}" not found` };
    }

    const { latitude, longitude, name, country } = geoResponse.data.results[0];

    // Get weather data
    const weatherResponse = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`
    );

    const current = weatherResponse.data.current;
    const weatherCodes = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      95: 'Thunderstorm',
      96: 'Thunderstorm with light hail',
      99: 'Thunderstorm with heavy hail',
    };

    return {
      location: `${name}, ${country}`,
      temperature: `${current.temperature_2m}°C`,
      feels_like: `${current.apparent_temperature}°C`,
      humidity: `${current.relative_humidity_2m}%`,
      wind_speed: `${current.wind_speed_10m} km/h`,
      conditions: weatherCodes[current.weather_code] || 'Unknown',
      precipitation: `${current.precipitation} mm`,
    };
  } catch (error) {
    return { error: error.message };
  }
};

// Export tool implementation
export default {
  weather: weatherTool,
  definition: [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather information for any city in the world',
        parameters: {
          type: 'object',
          properties: {
            city: {
              type: 'string',
              description: 'The name of the city (e.g., Paris, London, Tokyo)',
            },
          },
          required: ['city'],
        },
      },
    },
  ],
};

