'use client';

import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanyard } from '@/hooks/useLanyard';
import { useDiscordUser } from '@/hooks/useDiscordUser';
import { STATUS_COLORS } from '@/lib/constants';
import { BentoCard } from '@/components/ui/BentoCard';
import { Monitor, Smartphone, Globe, Github, Twitter } from 'lucide-react';

const API_BASE = 'https://camilo404.azurewebsites.net';

export function ProfileCard() {
  const { data, isLoading, error } = useLanyard();
  const { data: userData } = useDiscordUser();

  const avatarUrl = data?.discord_user?.id
    ? `${API_BASE}/v1/avatar/${data.discord_user.id}`
    : 'https://cdn.discordapp.com/embed/avatars/0.png';



  const avatarDecorationUrl = data?.discord_user?.avatar_decoration_data
    ? `https://cdn.discordapp.com/avatar-decoration-presets/${data.discord_user.avatar_decoration_data.asset}.png?size=96`
    : null;

  const statusColor = data?.discord_status
    ? STATUS_COLORS[data.discord_status]
    : STATUS_COLORS.offline;

  const displayName = data?.discord_user?.display_name || data?.discord_user?.global_name || 'luca';
  const username = data?.discord_user?.username || 'ossed';

  // Get pronouns from user profile
  const pronouns = userData?.user_profile?.pronouns || '';

  // Get active platforms
  const activePlatforms = [];
  if (data?.active_on_discord_desktop) activePlatforms.push('desktop');
  if (data?.active_on_discord_mobile) activePlatforms.push('mobile');
  if (data?.active_on_discord_web) activePlatforms.push('web');

  // Get clan tag and badge from userData (preferred) or fallback to Lanyard data
  const clanTag = userData?.user?.clan?.tag || data?.discord_user?.primary_guild?.tag;
  const clanBadge = userData?.user?.clan?.badge || data?.discord_user?.primary_guild?.badge;
  const clanGuildId = userData?.user?.clan?.identity_guild_id || data?.discord_user?.primary_guild?.identity_guild_id;
  const clanBadgeUrl = clanBadge && clanGuildId
    ? `https://cdn.discordapp.com/clan-badges/${clanGuildId}/${clanBadge}.png?size=32`
    : null;

  // Badge tooltip state (click to show)
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);
  const badgeTooltipRef = useRef<HTMLDivElement>(null);

  // Clan tooltip state
  const [showClanTooltip, setShowClanTooltip] = useState(false);
  const [guildData, setGuildData] = useState<{ name: string; presence_count: number; instant_invite: string | null } | null>(null);
  const [guildLoading, setGuildLoading] = useState(false);
  const clanTooltipRef = useRef<HTMLDivElement>(null);

  const fetchClanData = useCallback(async () => {
    if (!clanGuildId || guildData || guildLoading) return;

    setGuildLoading(true);
    try {
      const response = await fetch(`/api/discord-guild?id=${clanGuildId}`);
      if (!response.ok) return;
      const payload = await response.json();
      if (payload) setGuildData(payload);
    } catch {
      // Ignore and keep tooltip minimal.
    } finally {
      setGuildLoading(false);
    }
  }, [clanGuildId, guildData, guildLoading]);

  const handleClanToggle = useCallback(() => {
    const shouldOpen = !showClanTooltip;
    setShowClanTooltip(shouldOpen);
    if (shouldOpen) {
      void fetchClanData();
    }
  }, [showClanTooltip, fetchClanData]);

  // Close tooltips on outside click
  useEffect(() => {
    if (!showClanTooltip && !activeBadgeId) return;
    const handleClick = (e: MouseEvent) => {
      if (showClanTooltip && clanTooltipRef.current && !clanTooltipRef.current.contains(e.target as Node)) {
        setShowClanTooltip(false);
      }
      if (activeBadgeId && badgeTooltipRef.current && !badgeTooltipRef.current.contains(e.target as Node)) {
        setActiveBadgeId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showClanTooltip, activeBadgeId]);

  // Get user badges
  const badges = userData?.badges || [];

  // Get member since date
  const premiumSince = userData?.premium_since;
  const premiumGuildSince = userData?.premium_guild_since;

  // Helper to get badge tooltip info (description + date for Nitro/Booster)
  const getBadgeTooltip = (badge: { id: string; description: string }) => {
    const lines: string[] = [badge.description];

    if (badge.id.startsWith('premium') && premiumSince) {
      const since = new Date(premiumSince);
      const now = new Date();
      const diffMs = now.getTime() - since.getTime();
      const years = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
      const months = Math.floor((diffMs % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
      const dateStr = since.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      let duration = '';
      if (years > 0) duration += `${years} year${years !== 1 ? 's' : ''}`;
      if (months > 0) duration += `${duration ? ', ' : ''}${months} month${months !== 1 ? 's' : ''}`;
      lines.push(`Subscriber since ${dateStr}${duration ? ` (${duration})` : ''}`);
    }

    if (badge.id.startsWith('guild_booster') && premiumGuildSince) {
      const since = new Date(premiumGuildSince);
      const now = new Date();
      const diffMs = now.getTime() - since.getTime();
      const years = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
      const months = Math.floor((diffMs % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
      const dateStr = since.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      let duration = '';
      if (years > 0) duration += `${years} year${years !== 1 ? 's' : ''}`;
      if (months > 0) duration += `${duration ? ', ' : ''}${months} month${months !== 1 ? 's' : ''}`;
      lines.push(`Boosting since ${dateStr}${duration ? ` (${duration})` : ''}`);
    }

    return lines;
  };

  if (isLoading) {
    return (
      <BentoCard colSpan={4} className="profile-card-merged">
        <div className="pcm-loading-shell" aria-label="Loading profile" aria-busy="true">
          <div className="pcm-loading-header">
            <div className="pcm-loading-avatar pcm-loading-shimmer" />
            <div className="pcm-loading-head-meta">
              <div className="pcm-loading-line pcm-loading-line-lg pcm-loading-shimmer" />
              <div className="pcm-loading-line pcm-loading-line-md pcm-loading-shimmer" />
              <div className="pcm-loading-badges">
                <span className="pcm-loading-badge pcm-loading-shimmer" />
                <span className="pcm-loading-badge pcm-loading-shimmer" />
                <span className="pcm-loading-badge pcm-loading-shimmer" />
              </div>
            </div>
          </div>

          <div className="pcm-loading-message-list">
            <div className="pcm-loading-message-row">
              <span className="pcm-loading-message-dot pcm-loading-shimmer" />
              <div className="pcm-loading-message-lines">
                <div className="pcm-loading-line pcm-loading-line-chat pcm-loading-shimmer" />
                <div className="pcm-loading-line pcm-loading-line-chat-short pcm-loading-shimmer" />
              </div>
            </div>
            <div className="pcm-loading-message-row">
              <span className="pcm-loading-message-dot pcm-loading-shimmer" />
              <div className="pcm-loading-message-lines">
                <div className="pcm-loading-line pcm-loading-line-chat pcm-loading-shimmer" />
                <div className="pcm-loading-line pcm-loading-line-chat-mid pcm-loading-shimmer" />
              </div>
            </div>
          </div>

          <div className="pcm-loading-footer">
            <span className="pcm-loading-icon pcm-loading-shimmer" />
            <span className="pcm-loading-icon pcm-loading-shimmer" />
            <span className="pcm-loading-icon pcm-loading-shimmer" />
            <span className="pcm-loading-icon pcm-loading-shimmer" />
          </div>
        </div>
      </BentoCard>
    );
  }

  if (error) {
    return (
      <BentoCard colSpan={4} className="profile-card-merged">
        <div className="flex items-center justify-center h-full">
          <div className="text-sm text-red-400">Failed to load profile</div>
        </div>
      </BentoCard>
    );
  }

  return (
    <BentoCard colSpan={4} className="profile-card-merged">
      {/* Top Section: Avatar + Info */}
      <div className="pcm-header">
        {/* Avatar */}
          <div className="pcm-avatar-wrap">
          <div className="pcm-avatar-container">
            <Image
              src={avatarUrl}
              alt="Avatar"
              className="pcm-avatar-img"
              width={96}
              height={96}
              unoptimized
            />
            {avatarDecorationUrl && (
              <Image
                src={avatarDecorationUrl}
                alt="Avatar Decoration"
                className="pcm-avatar-decoration"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                width={110}
                height={110}
                unoptimized
              />
            )}
            <div
              className="pcm-status-dot"
              style={{ backgroundColor: statusColor }}
            />
          </div>
        </div>

        {/* Info */}
        <div className="pcm-info">
          {/* Name + Clan */}
          <div className="pcm-name-row">
            <h1 className="pcm-display-name">{displayName}</h1>
            {clanTag && (
              <div className="clan-tag-wrapper" ref={clanTooltipRef}>
                <button
                  className="clan-tag-v2"
                  onClick={handleClanToggle}
                  type="button"
                >
                  {clanBadgeUrl && (
                    <Image
                      src={clanBadgeUrl}
                      alt="Clan Badge"
                      className="clan-badge-icon-v2"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      width={20}
                      height={20}
                      unoptimized
                    />
                  )}
                  <span>{clanTag}</span>
                </button>

                {/* Clan Tooltip Popup */}
                {showClanTooltip && (
                  <div className="clan-tooltip-popup">
                    {clanGuildId && (
                      <div className="clan-tooltip-banner">
                        <Image
                          src={`https://cdn.discordapp.com/discovery-splashes/${clanGuildId}/banner.png?size=480`}
                          alt=""
                          className="clan-tooltip-banner-img"
                          onError={(e) => {
                            const parent = e.currentTarget.parentElement;
                            if (parent) parent.style.display = 'none';
                          }}
                          width={480}
                          height={180}
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="clan-tooltip-content">
                      <div className="clan-tooltip-name">
                        {clanBadgeUrl && (
                          <Image
                            src={clanBadgeUrl}
                            alt=""
                            className="clan-tooltip-badge"
                            width={18}
                            height={18}
                            unoptimized
                          />
                        )}
                        <span>{guildData?.name || clanTag}</span>
                      </div>
                      {guildData && (
                        <div className="clan-tooltip-stats">
                          <span className="clan-tooltip-online">
                            <span className="clan-tooltip-dot" style={{ backgroundColor: '#3ba55c' }} />
                            {guildData.presence_count.toLocaleString()} Online
                          </span>
                        </div>
                      )}
                      {guildLoading && (
                        <div className="clan-tooltip-stats">
                          <span className="text-xs text-gray-500">Loading...</span>
                        </div>
                      )}
                      <a
                        href={guildData?.instant_invite || `https://discord.com/servers/${clanGuildId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="clan-tooltip-btn"
                      >
                        Go to Server
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description line: username + pronouns + badges */}
          <div className="pcm-meta-line">
            <span className="pcm-username">{username}</span>
            {pronouns && (
              <>
                <span className="pcm-separator">•</span>
                <span className="pcm-pronouns">{pronouns}</span>
              </>
            )}
            {badges.length > 0 && (
              <div className="profile-badges-inline">
                {badges.slice(0, 6).map((badge) => {
                  const tooltipLines = getBadgeTooltip(badge);
                  const isActive = activeBadgeId === badge.id;
                  return (
                    <div
                      key={badge.id}
                      className="badge-tooltip-wrapper"
                      ref={isActive ? badgeTooltipRef : undefined}
                    >
                      <Image
                        src={`${API_BASE}/v1/badge/${badge.icon}.png`}
                        alt={badge.description}
                        className="profile-badge-icon-v2"
                        onClick={() => setActiveBadgeId(isActive ? null : badge.id)}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        width={20}
                        height={20}
                        unoptimized
                      />
                      {isActive && (
                        <div className="badge-tooltip">
                          {tooltipLines.map((line, i) => (
                            <span key={i} className={i === 0 ? 'badge-tooltip-title' : 'badge-tooltip-detail'}>
                              {line}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bio */}
          {userData?.user?.bio && (
            <p className="pcm-bio">{userData.user.bio}</p>
          )}

          {/* Platform Indicators */}
          {activePlatforms.length > 0 && (
            <div className="pcm-platforms">
              {activePlatforms.includes('desktop') && (
                <div className="platform-icon-v2" title="Desktop">
                  <Monitor className="w-3.5 h-3.5" />
                </div>
              )}
              {activePlatforms.includes('mobile') && (
                <div className="platform-icon-v2" title="Mobile">
                  <Smartphone className="w-3.5 h-3.5" />
                </div>
              )}
              {activePlatforms.includes('web') && (
                <div className="platform-icon-v2" title="Web">
                  <Globe className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          )}

        </div>
      </div>


      {/* Connections Row */}
      <div className="pcm-connections">
        <a
          href="https://github.com/yourusername"
          target="_blank"
          rel="noopener noreferrer"
          className="pcm-conn-btn"
          title="GitHub"
        >
          <Github className="w-5 h-5" />
        </a>
        <a
          href="https://twitter.com/yourusername"
          target="_blank"
          rel="noopener noreferrer"
          className="pcm-conn-btn"
          title="Twitter"
        >
          <Twitter className="w-5 h-5" />
        </a>
        <a
          href="https://osu.ppy.sh/users/youruserid"
          target="_blank"
          rel="noopener noreferrer"
          className="pcm-conn-btn"
          title="osu!"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" />
          </svg>
        </a>
        <a
          href="https://steamcommunity.com/id/yourusername"
          target="_blank"
          rel="noopener noreferrer"
          className="pcm-conn-btn"
          title="Steam"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M11.99 0C5.38 0 .01 5.35.01 11.95c0 5.23 3.39 9.68 8.08 11.3l1.83-2.65c-.24-.31-.38-.69-.38-1.1 0-1.66 1.34-3 3-3s3 1.34 3 3-1.34 3-3 3c-.15 0-.29-.02-.43-.05l-2.02 2.93c.62.1 1.25.17 1.91.17 6.61 0 11.99-5.35 11.99-11.95S18.6 0 11.99 0z" />
          </svg>
        </a>
        <a
          href="https://discord.com/users/youruserid"
          target="_blank"
          rel="noopener noreferrer"
          className="pcm-conn-btn"
          title="Discord"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
        </a>
      </div>
    </BentoCard>
  );
}
