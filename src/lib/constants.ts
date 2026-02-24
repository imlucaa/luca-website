// API Configuration
export const DISCORD_ID = process.env.NEXT_PUBLIC_DISCORD_ID || '1132691475830943744';
export const LASTFM_USERNAME = process.env.LASTFM_USERNAME || 'lucasssca';
export const LASTFM_API_KEY = process.env.LASTFM_API_KEY || '2df274d52e33e3d87ed5ad9466f5efe5';
export const STEAM_ID = process.env.STEAM_ID || '76561199537922693';
export const STEAM_API_KEY = process.env.STEAM_API_KEY || '35361B442FF8A7EF51204BF9BC6BC76B';
export const WEATHER_LOCATION = process.env.WEATHER_LOCATION || 'Launceston';

// Valorant Configuration
export const HENRIK_API_KEY = process.env.HENRIK_API_KEY || 'HDEV-ff0dc7ff-73be-44b2-8c34-5451c657e5a3';

// osu! Configuration
export const OSU_CLIENT_ID = process.env.OSU_CLIENT_ID || '48839';
export const OSU_CLIENT_SECRET = process.env.OSU_CLIENT_SECRET || '2Fd1Qfcd2byhioQq1x1JwyGQIgPIQN1BO4PUKX8Z';
export const OSU_USERNAME = process.env.OSU_USERNAME || 'lucacaa';
export const OSU_MODE = 'mania';

// KovaaK's Configuration
export const KOVAAKS_USERNAME = process.env.KOVAAKS_USERNAME || 'ossed';
export const KOVAAKS_STEAM_ID = process.env.KOVAAKS_STEAM_ID || '76561199537922693';

// Twitter/X Configuration
export const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || 'AAAAAAAAAAAAAAAAAAAAAGTG7gEAAAAAVD01aoMtrrpLIhU3M1Yx6k6A9OE%3DUQggGCMI0jgZv1YoeOTaxNn4HvkqQ0sknXTGjxcntwVUTRuMnn';
export const TWITTER_USERNAME = process.env.TWITTER_USERNAME || 'osseds';

// Status Colors
export const STATUS_COLORS = {
  online: '#22c55e',
  idle: '#eab308',
  dnd: '#ef4444',
  offline: '#71717a'
} as const;

// Status Names
export const STATUS_NAMES = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline'
} as const;

// Weather Codes
export const WEATHER_CODES: Record<number, string> = {
  0: 'Clear',
  1: 'Clear',
  2: 'Cloudy',
  3: 'Overcast',
  45: 'Fog',
  51: 'Drizzle',
  61: 'Rain',
  71: 'Snow',
  95: 'Storm'
};
