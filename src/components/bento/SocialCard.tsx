import { Github, Twitter } from 'lucide-react';
import { BentoCard } from '@/components/ui/BentoCard';

export function SocialCard() {
  return (
    <BentoCard colSpan={2} className="social-card">
      <span className="text-label mb-3">Connections</span>
      <div className="socials-grid">
        <a
          href="https://github.com/yourusername"
          target="_blank"
          rel="noopener noreferrer"
          className="social-btn"
          title="GitHub"
        >
          <Github className="w-5 h-5" />
        </a>
        <a
          href="https://twitter.com/yourusername"
          target="_blank"
          rel="noopener noreferrer"
          className="social-btn"
          title="Twitter"
        >
          <Twitter className="w-5 h-5" />
        </a>
        <a
          href="https://osu.ppy.sh/users/youruserid"
          target="_blank"
          rel="noopener noreferrer"
          className="social-btn"
          title="OSU!"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" />
          </svg>
        </a>
        <a
          href="https://steamcommunity.com/id/yourusername"
          target="_blank"
          rel="noopener noreferrer"
          className="social-btn"
          title="Steam"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M11.99 0C5.38 0 .01 5.35.01 11.95c0 5.23 3.39 9.68 8.08 11.3l1.83-2.65c-.24-.31-.38-.69-.38-1.1 0-1.66 1.34-3 3-3s3 1.34 3 3-1.34 3-3 3c-.15 0-.29-.02-.43-.05l-2.02 2.93c.62.1 1.25.17 1.91.17 6.61 0 11.99-5.35 11.99-11.95S18.6 0 11.99 0z" />
          </svg>
        </a>
      </div>
    </BentoCard>
  );
}
