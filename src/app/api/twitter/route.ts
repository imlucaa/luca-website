import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/server/rate-limit';
import { kvGetWithStale, kvSetWithTimestamp } from '@/lib/server/kv-cache';
import type { TwitterData, TwitterUser, TwitterTweet, TwitterMedia } from '@/lib/types';
import { TWITTER_USERNAME } from '@/lib/constants';

const TWITTER_DEFAULT_USERNAME = TWITTER_USERNAME;

const TWITTER_CACHE_TTL_MS = 5 * 60 * 1000;
const TWITTER_STALE_TTL_MS = 15 * 60 * 1000;
const TWITTER_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const TWITTER_RATE_LIMIT_MAX_REQUESTS = 30;

// Nitter instances to try (in order of preference)
const NITTER_INSTANCES = [
  'nitter.net',
  'nitter.privacydev.net',
  'nitter.poast.org',
];

// In-memory cache per username
const userCaches = new Map<string, { payload: TwitterData; cachedAt: number }>();

class TwitterApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'TwitterApiError';
  }
}

function getCacheHeaders(cacheStatus: 'HIT' | 'MISS' | 'STALE' | 'HIT_KV'): HeadersInit {
  return {
    'Cache-Control': 's-maxage=300, stale-while-revalidate=900',
    'X-Twitter-Cache': cacheStatus,
  };
}

function getCacheKey(username: string): string {
  return `api:twitter:v7:${username.toLowerCase()}`;
}

// ─── FxTwitter API ───────────────────────────────────────────────────────────

interface FxTwitterUserResponse {
  code: number;
  message: string;
  user: {
    id: string;
    name: string;
    screen_name: string;
    description: string;
    location: string;
    banner_url?: string;
    avatar_url: string;
    followers: number;
    following: number;
    likes: number;
    tweets: number;
    media_count: number;
    joined: string;
    protected: boolean;
    website?: { url: string; display_url: string };
    verification?: { verified: boolean; type: string };
  };
}

interface FxTweetMedia {
  type: 'photo' | 'video' | 'animated_gif';
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  duration?: number;
}

interface FxTweetResponse {
  code: number;
  message: string;
  tweet: {
    id: string;
    url: string;
    text: string;
    raw_text?: { text: string };
    created_at: string;
    author: {
      name: string;
      screen_name: string;
      avatar_url: string;
    };
    likes: number;
    replies: number;
    retweets: number;
    views?: number;
    media?: {
      all: FxTweetMedia[];
    };
    article?: {
      title?: string;
      preview_text?: string;
      cover_media?: {
        media_info?: {
          original_img_url?: string;
        };
      };
    };
  };
}

/**
 * Fetch user profile from FxTwitter API (free, no auth required).
 */
async function fetchUserProfile(username: string): Promise<TwitterUser> {
  const url = `https://api.fxtwitter.com/${encodeURIComponent(username)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'luca-website/1.0',
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new TwitterApiError('Twitter user not found.', 404, 'NOT_FOUND');
    }
    if (response.status === 429) {
      throw new TwitterApiError('Rate limited. Please try again later.', 429, 'RATE_LIMITED', 60);
    }
    throw new TwitterApiError(
      `Failed to fetch Twitter profile: ${response.status}`,
      response.status >= 500 ? 502 : response.status,
      'TWITTER_UPSTREAM_ERROR'
    );
  }

  const data: FxTwitterUserResponse = await response.json();
  const user = data.user;
  console.log(`[Twitter] Profile for @${username}: banner_url=${user.banner_url || 'none'}, avatar=${user.avatar_url}`);
  const profileImageUrl = user.avatar_url?.replace('_normal', '_200x200');

  return {
    id: user.id,
    name: user.name,
    username: user.screen_name,
    profile_image_url: profileImageUrl,
    description: user.description || undefined,
    banner_url: user.banner_url || undefined,
    location: user.location || undefined,
    website: user.website || undefined,
    public_metrics: {
      followers_count: user.followers,
      following_count: user.following,
      tweet_count: user.tweets,
      listed_count: 0,
    },
    created_at: user.joined,
    verified: user.verification?.verified,
  };
}

// ─── Tweet ID Fetching (Multiple Methods) ────────────────────────────────────

/**
 * Method 1: Parse tweet IDs from Nitter RSS feed.
 */
function parseTweetIdsFromRss(xml: string, limit: number): string[] {
  const ids: string[] = [];
  const guidRegex = /<guid[^>]*>(\d+)<\/guid>/g;
  let match;
  while ((match = guidRegex.exec(xml)) !== null && ids.length < limit) {
    ids.push(match[1]);
  }
  return ids;
}

/**
 * Method 2: Parse tweet IDs from Nitter HTML page.
 * Looks for links like /username/status/TWEET_ID
 */
function parseTweetIdsFromHtml(html: string, username: string, limit: number): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  // Match tweet status links: /username/status/1234567890
  const linkRegex = new RegExp(`/${username}/status/(\\d+)`, 'gi');
  let match;
  while ((match = linkRegex.exec(html)) !== null && ids.length < limit) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Fetch tweet IDs from Nitter (tries RSS first, then HTML page).
 */
async function fetchTweetIds(username: string, limit = 5): Promise<string[]> {
  for (const instance of NITTER_INSTANCES) {
    // Try RSS first
    try {
      const rssUrl = `https://${instance}/${encodeURIComponent(username)}/rss`;
      console.log(`[Twitter] Trying RSS: ${rssUrl}`);
      const response = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; luca-website/1.0)' },
        signal: AbortSignal.timeout(10000),
        cache: 'no-store',
      });

      console.log(`[Twitter] RSS ${instance} status: ${response.status}`);
      if (response.ok) {
        const text = await response.text();
        console.log(`[Twitter] RSS response length: ${text.length}, has rss: ${text.includes('<rss')}, has channel: ${text.includes('<channel>')}`);
        if (text.includes('<rss') || text.includes('<channel>')) {
          const ids = parseTweetIdsFromRss(text, limit);
          if (ids.length > 0) {
            console.log(`[Twitter] Got ${ids.length} tweet IDs from ${instance} RSS: ${ids.join(', ')}`);
            return ids;
          }
        }
      }
    } catch (err) {
      console.log(`[Twitter] RSS ${instance} error:`, err instanceof Error ? err.message : err);
    }

    // Try HTML page as fallback
    try {
      const htmlUrl = `https://${instance}/${encodeURIComponent(username)}`;
      console.log(`[Twitter] Trying HTML: ${htmlUrl}`);
      const response = await fetch(htmlUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000),
        cache: 'no-store',
      });

      console.log(`[Twitter] HTML ${instance} status: ${response.status}`);
      if (response.ok) {
        const html = await response.text();
        const hasTimeline = html.includes('timeline-item') || html.includes('tweet-link');
        console.log(`[Twitter] HTML response length: ${html.length}, has timeline: ${hasTimeline}`);
        if (hasTimeline) {
          const ids = parseTweetIdsFromHtml(html, username, limit);
          if (ids.length > 0) {
            console.log(`[Twitter] Got ${ids.length} tweet IDs from ${instance} HTML: ${ids.join(', ')}`);
            return ids;
          }
        }
      }
    } catch (err) {
      console.log(`[Twitter] HTML ${instance} error:`, err instanceof Error ? err.message : err);
      continue;
    }
  }

  console.log(`[Twitter] Could not fetch tweet IDs for @${username} from any Nitter instance`);
  return [];
}

// ─── FxTwitter Tweet Fetching ────────────────────────────────────────────────

/**
 * Fetch a single tweet's full data from FxTwitter API.
 */
async function fetchTweetFromFxTwitter(username: string, tweetId: string): Promise<TwitterTweet | null> {
  try {
    const url = `https://api.fxtwitter.com/${encodeURIComponent(username)}/status/${tweetId}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'luca-website/1.0',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.log(`[Twitter] FxTwitter tweet ${tweetId} returned ${response.status}`);
      return null;
    }

    const data: FxTweetResponse = await response.json();
    const tweet = data.tweet;

    const media: TwitterMedia[] = (tweet.media?.all || []).map((m) => ({
      type: m.type === 'animated_gif' ? 'animated_gif' as const : m.type === 'video' ? 'video' as const : 'photo' as const,
      url: m.url,
      thumbnail_url: m.thumbnail_url,
      width: m.width,
      height: m.height,
      duration: m.duration,
    }));

    // If tweet has an article with a cover image, add it as media
    if (tweet.article?.cover_media?.media_info?.original_img_url && media.length === 0) {
      media.push({
        type: 'photo',
        url: tweet.article.cover_media.media_info.original_img_url,
      });
    }

    // Build tweet text: use text, fallback to raw_text, fallback to article title
    let tweetText = tweet.text;
    if (!tweetText && tweet.raw_text?.text) {
      // raw_text often contains t.co links - clean them up
      tweetText = tweet.raw_text.text.replace(/https?:\/\/t\.co\/\S+/g, '').trim();
    }
    if (!tweetText && tweet.article) {
      tweetText = tweet.article.title || tweet.article.preview_text || '';
    }

    return {
      id: tweet.id,
      url: tweet.url,
      text: tweetText,
      created_at: tweet.created_at,
      author: {
        name: tweet.author.name,
        screen_name: tweet.author.screen_name,
        avatar_url: tweet.author.avatar_url,
      },
      likes: tweet.likes,
      replies: tweet.replies,
      retweets: tweet.retweets,
      views: tweet.views,
      media: media.length > 0 ? media : undefined,
    };
  } catch (err) {
    console.log(`[Twitter] Error fetching tweet ${tweetId}:`, err);
    return null;
  }
}

/**
 * Fetch multiple tweets in parallel from FxTwitter.
 */
async function fetchTweets(username: string, tweetIds: string[]): Promise<TwitterTweet[]> {
  const results = await Promise.allSettled(
    tweetIds.map((id) => fetchTweetFromFxTwitter(username, id))
  );

  const tweets = results
    .filter((r): r is PromiseFulfilledResult<TwitterTweet | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((t): t is TwitterTweet => t !== null);

  console.log(`[Twitter] Fetched ${tweets.length}/${tweetIds.length} tweets from FxTwitter`);
  return tweets;
}

// ─── Main Data Fetcher ───────────────────────────────────────────────────────

async function fetchTwitterData(username: string): Promise<TwitterData> {
  // Fetch user profile first to check tweet count
  const user = await fetchUserProfile(username);

  // If user has 0 tweets, skip tweet fetching
  if (user.public_metrics?.tweet_count === 0) {
    console.log(`[Twitter] @${username} has 0 tweets, skipping tweet fetch`);
    return { user, tweets: [] };
  }

  // Fetch tweet IDs from Nitter (RSS + HTML fallback) - latest 5 posts
  const tweetIds = await fetchTweetIds(username, 5);

  // Fetch full tweet data for each ID
  let tweets: TwitterTweet[] = [];
  if (tweetIds.length > 0) {
    tweets = await fetchTweets(username, tweetIds);
  }

  return { user, tweets };
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    // Rate limiting
    const rl = rateLimit(request, {
      namespace: 'api:twitter',
      limit: TWITTER_RATE_LIMIT_MAX_REQUESTS,
      windowMs: TWITTER_RATE_LIMIT_WINDOW_MS,
    });

    if (!rl.ok) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          code: 'RATE_LIMITED',
          retryAfter: rl.retryAfter,
        },
        { status: 429, headers: rl.headers }
      );
    }

    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') || TWITTER_DEFAULT_USERNAME;
    const cacheKey = getCacheKey(username);

    // Check in-memory cache
    const memCache = userCaches.get(username.toLowerCase());
    if (memCache) {
      const age = Date.now() - memCache.cachedAt;
      if (age < TWITTER_CACHE_TTL_MS) {
        return NextResponse.json(memCache.payload, {
          headers: { ...rl.headers, ...getCacheHeaders('HIT') },
        });
      }
    }

    // Check KV cache
    const kvResult = await kvGetWithStale<TwitterData>(cacheKey, {
      freshMs: TWITTER_CACHE_TTL_MS,
      staleMs: TWITTER_STALE_TTL_MS,
    });

    if (kvResult && !kvResult.isStale) {
      userCaches.set(username.toLowerCase(), { payload: kvResult.value, cachedAt: Date.now() });
      return NextResponse.json(kvResult.value, {
        headers: { ...rl.headers, ...getCacheHeaders('HIT_KV') },
      });
    }

    // Fetch fresh data
    try {
      const data = await fetchTwitterData(username);

      // Update caches
      userCaches.set(username.toLowerCase(), { payload: data, cachedAt: Date.now() });
      await kvSetWithTimestamp(cacheKey, data, TWITTER_STALE_TTL_MS);

      return NextResponse.json(data, {
        headers: { ...rl.headers, ...getCacheHeaders('MISS') },
      });
    } catch (fetchError) {
      // If we have stale data, return it
      if (kvResult) {
        return NextResponse.json(kvResult.value, {
          headers: { ...rl.headers, ...getCacheHeaders('STALE') },
        });
      }
      throw fetchError;
    }
  } catch (error) {
    if (error instanceof TwitterApiError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          retryAfter: error.retryAfter,
        },
        { status: error.status }
      );
    }

    console.error('[Twitter] API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
