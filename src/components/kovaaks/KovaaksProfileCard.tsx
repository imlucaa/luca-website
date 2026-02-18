'use client';

import type { KovaaksUserProfile, KovaaksBenchmarkProgress, KovaaksVtEnergyResult } from '@/lib/types';
import { Crosshair, Zap, Trophy } from 'lucide-react';

interface KovaaksProfileCardProps {
  profile: KovaaksUserProfile;
  benchmarks: KovaaksBenchmarkProgress | null;
  allBenchmarks?: Record<string, KovaaksBenchmarkProgress | null>;
  bestVtEnergy?: KovaaksVtEnergyResult | null;
}

export function KovaaksProfileCard({ profile, bestVtEnergy }: KovaaksProfileCardProps) {
  // Use VT-Energy rank as the primary rank display
  const rankName = bestVtEnergy?.rankName || 'Unranked';
  const rankColor = bestVtEnergy?.rankColor || '#6b7280';
  const harmonicMean = bestVtEnergy?.harmonicMean ?? 0;
  const difficultyName = bestVtEnergy?.difficultyName || '';

  return (
    <div className="bento-card col-span-4 relative overflow-hidden !p-5">
      {/* Background gradient */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: `radial-gradient(ellipse at 30% 50%, ${rankColor}40, transparent 70%)`,
        }}
      />

      <div className="relative z-10">
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-4">
          <div className="kvk-profile-avatar">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.webAppUsername}
                className="w-full h-full object-cover"
              />
            ) : (
              <Crosshair size={28} className="text-orange-400" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {profile.webAppUsername}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="kvk-rank-badge"
                style={{ color: rankColor, borderColor: `${rankColor}40`, background: `${rankColor}15` }}
              >
                {rankName}
              </span>
              {difficultyName && (
                <span className="text-xs text-gray-500">
                  {difficultyName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Row - Only VT Energy and Energy Rank */}
        <div className="kvk-stats-row">
          <div className="kvk-stat-card">
            <Zap size={14} className="text-orange-400" />
            <div>
              <div className="kvk-stat-value" style={{ color: rankColor }}>{harmonicMean > 0 ? harmonicMean.toFixed(1) : '—'}</div>
              <div className="kvk-stat-label">VT Energy</div>
            </div>
          </div>
          <div className="kvk-stat-card">
            <Trophy size={14} className="text-orange-400" />
            <div>
              <div className="kvk-stat-value" style={{ color: rankColor }}>{rankName}</div>
              <div className="kvk-stat-label">Energy Rank</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
