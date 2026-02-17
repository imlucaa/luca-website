import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(ms: number): string {
  if (!ms || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}:${rs.toString().padStart(2, '0')}`;
}

export function getTimeAgo(timestamp: number): string {
  if (!timestamp) return '';
  const now = Math.floor(Date.now() / 1000);
  const diffSecs = now - timestamp;
  const diffMins = Math.floor(diffSecs / 60);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function formatDuration(duration: number): string {
  if (!duration) return '';
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getActivityImageUrl(activity: { assets?: { large_image?: string; small_image?: string }; application_id?: string }): string | null {
  if (!activity) return null;

  if (activity.assets) {
    const largeImage = activity.assets.large_image;
    const smallImage = activity.assets.small_image;
    const image = largeImage || smallImage;

    if (image) {
      if (image.startsWith('mp:external')) {
        return image.replace(/mp:external\/([^\/]*)\/?(http[s]?)/g, '$2://');
      } else if (image.startsWith('mp:')) {
        return `https://media.discordapp.net/${image.replace('mp:', '')}`;
      } else if (activity.application_id) {
        const extension = image.includes('.') ? '' : '.png';
        return `https://cdn.discordapp.com/app-assets/${activity.application_id}/${image}${extension}`;
      }
    }
  }

  if (activity.application_id) {
    return `https://cdn.discordapp.com/app-icons/${activity.application_id}/${activity.application_id}.png`;
  }

  return null;
}
