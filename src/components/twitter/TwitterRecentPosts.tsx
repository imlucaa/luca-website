'use client';

import { TwitterTweet } from '@/lib/types';
import { ExternalLink } from 'lucide-react';

interface TwitterRecentPostsProps {
  tweets: TwitterTweet[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ', ' + date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function TweetCard({ tweet }: { tweet: TwitterTweet }) {
  const tweetUrl = tweet.url || `https://x.com/${tweet.author.screen_name}/status/${tweet.id}`;

  return (
    <div className="bento-card !p-4 overflow-hidden">
      {/* Header: Avatar + Name/Handle + Date + External Link */}
      <div className="flex items-start gap-3">
        <a
          href={`https://x.com/${tweet.author.screen_name}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0"
        >
          <img
            src={tweet.author.avatar_url}
            alt={tweet.author.name}
            className="w-10 h-10 rounded-full bg-[#333639]"
          />
        </a>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <a
                href={`https://x.com/${tweet.author.screen_name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold text-[#e7e9ea] hover:underline"
              >
                {tweet.author.name}
              </a>
              <span className="text-sm text-[#71767b] ml-1.5">
                @{tweet.author.screen_name}
              </span>
            </div>
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#71767b] hover:text-[#1d9bf0] transition-colors shrink-0 ml-2"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <p className="text-xs text-[#71767b] mt-0.5">{formatDate(tweet.created_at)}</p>
        </div>
      </div>

      {/* Tweet Text */}
      <p className="text-sm text-[#e7e9ea] mt-3 whitespace-pre-wrap leading-relaxed break-words">
        {tweet.text}
      </p>

      {/* Media */}
      {tweet.media && tweet.media.length > 0 && (
        <div className="mt-3 rounded-xl overflow-hidden border border-[#2f3336]">
          {tweet.media.map((media, idx) => (
            <div key={idx} className="relative">
              {media.type === 'photo' ? (
                <a href={tweetUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={media.url}
                    alt="Tweet media"
                    className="w-full max-h-[400px] object-cover"
                    loading="lazy"
                  />
                </a>
              ) : (
                <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className="block relative group cursor-pointer">
                  <img
                    src={media.thumbnail_url || media.url}
                    alt="Video thumbnail"
                    className="w-full max-h-[400px] object-cover"
                    loading="lazy"
                  />
                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-[#1d9bf0] flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  {/* Duration badge */}
                  {media.duration && (
                    <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/70 rounded text-xs text-white font-mono">
                      {formatDuration(media.duration)}
                    </div>
                  )}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TwitterRecentPosts({ tweets }: TwitterRecentPostsProps) {
  if (tweets.length === 0) {
    return (
      <div className="col-span-4">
        <div className="bento-card flex items-center justify-center min-h-[120px]">
          <p className="text-[#71767b] text-sm">This user hasn&apos;t posted yet.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {tweets.map((tweet) => (
        <div key={tweet.id} className="col-span-4">
          <TweetCard tweet={tweet} />
        </div>
      ))}
    </>
  );
}
