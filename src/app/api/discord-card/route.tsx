import { ImageResponse } from 'next/og';

/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */

export const runtime = 'edge';

const DISCORD_ID = '1132691475830943744';
const PROFILE_API = 'https://camilo404.azurewebsites.net';

type Activity = {
  name: string;
  type: number;
  details?: string;
  state?: string;
  application_id?: string;
  assets?: { large_image?: string; small_image?: string };
};

type LanyardResponse = {
  success: boolean;
  data: {
    discord_status: 'online' | 'idle' | 'dnd' | 'offline';
    discord_user: {
      id: string;
      username: string;
      global_name?: string;
      display_name?: string;
      avatar: string;
      avatar_decoration_data?: { asset: string };
    };
    listening_to_spotify: boolean;
    active_on_discord_desktop: boolean;
    active_on_discord_mobile: boolean;
    active_on_discord_web: boolean;
    active_on_discord_embedded?: boolean;
    active_on_discord_vr?: boolean;
    spotify?: {
      song: string;
      artist: string;
      album: string;
      album_art_url: string;
    };
    activities: Activity[];
  };
};

type ProfileResponse = {
  user_profile?: { pronouns?: string };
  badges?: Array<{ id: string; description: string; icon: string }>;
};

const statusColors = {
  online: '#23a55a',
  idle: '#f0b232',
  dnd: '#f23f43',
  offline: '#80848e',
};

const activityLabels: Record<number, string> = {
  0: 'Playing',
  1: 'Streaming',
  2: 'Listening to',
  3: 'Watching',
  5: 'Competing in',
};

function getActivityImage(activity: Activity): string | null {
  const image = activity.assets?.large_image || activity.assets?.small_image;
  if (!image) return null;

  if (image.startsWith('mp:external/')) {
    const path = image.slice('mp:external/'.length);
    const slashIndex = path.indexOf('/');
    return slashIndex === -1 ? null : path.slice(slashIndex + 1).replace('/', '://');
  }

  if (image.startsWith('mp:')) return `https://media.discordapp.net/${image.slice(3)}`;
  if (activity.application_id) {
    return `https://cdn.discordapp.com/app-assets/${activity.application_id}/${image}.png`;
  }

  return null;
}

export async function GET() {
  const [lanyardResult, profileResult] = await Promise.allSettled([
    fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`, { next: { revalidate: 30 } }).then(
      (response) => {
        if (!response.ok) throw new Error('Lanyard request failed');
        return response.json() as Promise<LanyardResponse>;
      },
    ),
    fetch(`${PROFILE_API}/v1/user/${DISCORD_ID}`, { next: { revalidate: 300 } }).then((response) => {
      if (!response.ok) throw new Error('Discord profile request failed');
      return response.json() as Promise<ProfileResponse>;
    }),
  ]);

  if (lanyardResult.status !== 'fulfilled' || !lanyardResult.value.success) {
    return new Response('Discord presence unavailable', { status: 503 });
  }

  const presence = lanyardResult.value.data;
  const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
  const badges = profile?.badges?.slice(0, 6) ?? [];
  const displayName = presence.discord_user.display_name || presence.discord_user.global_name || presence.discord_user.username;
  const avatar = `https://cdn.discordapp.com/avatars/${presence.discord_user.id}/${presence.discord_user.avatar}.png?size=160`;
  const decoration = presence.discord_user.avatar_decoration_data?.asset
    ? `https://cdn.discordapp.com/avatar-decoration-presets/${presence.discord_user.avatar_decoration_data.asset}.png?size=160`
    : null;

  const activity = presence.activities.find((item) => item.type !== 4);
  const music = presence.listening_to_spotify && presence.spotify ? presence.spotify : null;
  const platforms = [
    presence.active_on_discord_desktop && 'Desktop',
    presence.active_on_discord_mobile && 'Mobile',
    presence.active_on_discord_web && 'Web',
    presence.active_on_discord_embedded && 'Embedded',
    presence.active_on_discord_vr && 'VR',
  ].filter((platform): platform is string => Boolean(platform));
  const activityImage = music?.album_art_url || (activity ? getActivityImage(activity) : null);
  const activityLabel = music ? 'Listening to Spotify' : activity ? `${activityLabels[activity.type] || 'Using'} ${activity.name}` : 'No current activity';
  const activityTitle = music?.song || activity?.details || activity?.name || 'Taking it easy';
  const activityDetail = music?.artist || activity?.state || '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: '30px',
          color: '#f2f3f5',
          background: '#000000',
          border: '1px solid #26272b',
          borderRadius: '16px',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ width: '48%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '92px', height: '92px', display: 'flex', position: 'relative' }}>
              <img src={avatar} width="76" height="76" style={{ borderRadius: '50%', margin: '8px' }} />
              {decoration && <img src={decoration} width="92" height="92" style={{ position: 'absolute' }} />}
              <div
                style={{
                  position: 'absolute',
                  right: '7px',
                  bottom: '7px',
                  width: '19px',
                  height: '19px',
                  borderRadius: '50%',
                  border: '4px solid #000000',
                  background: statusColors[presence.discord_status],
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '16px' }}>
              <div style={{ fontSize: '25px', fontWeight: 700 }}>{displayName}</div>
              <div style={{ color: '#b5bac1', fontSize: '16px', marginTop: '4px' }}>@{presence.discord_user.username}</div>
              {profile?.user_profile?.pronouns && (
                <div style={{ color: '#949ba4', fontSize: '14px', marginTop: '4px' }}>{profile.user_profile.pronouns}</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                {platforms.length > 0 ? (
                  platforms.map((platform) => (
                    <div
                      key={platform}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginRight: '7px',
                        padding: '3px 7px',
                        borderRadius: '6px',
                        color: '#dbdee1',
                        background: '#1e1f22',
                        fontSize: '12px',
                      }}
                    >
                      <div
                        style={{
                          width: '6px',
                          height: '6px',
                          marginRight: '5px',
                          borderRadius: '50%',
                          background: statusColors[presence.discord_status],
                        }}
                      />
                      {platform}
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#80848e', fontSize: '12px' }}>Offline</div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginTop: '22px', height: '34px' }}>
            {badges.length > 0 ? (
              badges.map((badge) => (
                <img
                  key={badge.id}
                  src={`${PROFILE_API}/v1/badge/${badge.icon}.png`}
                  alt={badge.description}
                  width="28"
                  height="28"
                  style={{ marginRight: '10px' }}
                />
              ))
            ) : (
              <div style={{ color: '#949ba4', fontSize: '14px' }}>Discord profile</div>
            )}
          </div>
        </div>

        <div
          style={{
            width: '52%',
            display: 'flex',
            alignItems: 'center',
            padding: '22px',
            borderRadius: '12px',
            background: '#111214',
            border: '1px solid #232428',
          }}
        >
          {activityImage ? (
            <img src={activityImage} width="104" height="104" style={{ borderRadius: '10px', objectFit: 'cover' }} />
          ) : (
            <div
              style={{
                width: '104px',
                height: '104px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '10px',
                background: '#1e1f22',
                color: '#949ba4',
                fontSize: '32px',
              }}
            >
              ♪
            </div>
          )}
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', marginLeft: '20px' }}>
            <div style={{ color: '#b5bac1', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {activityLabel}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '9px' }}>{activityTitle}</div>
            {activityDetail && <div style={{ color: '#b5bac1', fontSize: '16px', marginTop: '6px' }}>{activityDetail}</div>}
          </div>
        </div>
      </div>
    ),
    {
      width: 760,
      height: 280,
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60' },
    },
  );
}
