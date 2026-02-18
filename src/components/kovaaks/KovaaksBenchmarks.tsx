'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Crosshair, Zap } from 'lucide-react';
import type { KovaaksBenchmarkProgress, KovaaksVtEnergyResult } from '@/lib/types';

// Rank colors matching Voltaic benchmark tiers
const RANK_COLORS: Record<string, string> = {
  'Unranked': '#6b7280',
  'Iron': '#999999',
  'Bronze': '#FF9900',
  'Silver': '#CBD9E6',
  'Gold': '#CAB148',
  'Platinum': '#2FCFC2',
  'Diamond': '#B9F2FF',
  'Jade': '#85FA85',
  'Master': '#EC44CA',
  'Grandmaster': '#FFD700',
  'Nova': '#7900FF',
  'Astra': '#FF2262',
  'Celestial': '#24DDD8',
  'Stellaris': '#979DDA',
  'Lunara': '#54418E',
  'Solara': '#FCFFA0',
};

interface KovaaksBenchmarksProps {
  benchmarks: KovaaksBenchmarkProgress | null;
  allBenchmarks?: Record<string, KovaaksBenchmarkProgress | null>;
  vtEnergy?: Record<string, KovaaksVtEnergyResult | null>;
}

/**
 * The KoVaaK's API returns scores multiplied by 100.
 * Convert to the real display value (divide by 100), rounded to integer.
 * The game displays whole numbers, so we round.
 */
function convertApiScore(apiScore: number): number {
  return Math.round(apiScore / 100);
}

function formatScore(score: number): string {
  if (score >= 1000) {
    return score.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return String(Math.round(score));
}

function getScenarioRankColor(scenarioRank: number, ranks: KovaaksBenchmarkProgress['ranks']): string {
  if (scenarioRank < 0 || scenarioRank >= ranks.length) return RANK_COLORS['Unranked'];
  const rankName = ranks[scenarioRank]?.name || 'Unranked';
  return ranks[scenarioRank]?.color || RANK_COLORS[rankName] || RANK_COLORS['Unranked'];
}

// Maps API category names to their subcategory names (in order)
const CATEGORY_SUBCATEGORIES: Record<string, string[]> = {
  'Clicking': ['Dynamic', 'Static', 'Linear'],
  'Tracking': ['Precise', 'Reactive', 'Control'],
  'Switching': ['Speed', 'Evasive', 'Stability'],
};

interface SubcategoryEnergyMap {
  [subcategoryName: string]: {
    energy: number;
    bestScenario: string;
    score: number;
  };
}

function buildSubcategoryEnergyMap(tierEnergy: KovaaksVtEnergyResult | null): SubcategoryEnergyMap {
  if (!tierEnergy) return {};
  const map: SubcategoryEnergyMap = {};
  for (const entry of tierEnergy.subcategoryEnergiesFlat) {
    map[entry.subcategoryName] = {
      energy: entry.energy,
      bestScenario: entry.bestScenario,
      score: entry.score,
    };
  }
  return map;
}

export function KovaaksBenchmarks({ benchmarks, allBenchmarks, vtEnergy }: KovaaksBenchmarksProps) {
  const [expandedTier, setExpandedTier] = useState<string | null>(() => {
    if (allBenchmarks) {
      for (const tier of ['novice', 'intermediate', 'advanced', 'elite']) {
        if (allBenchmarks[tier]) return tier;
      }
    }
    return benchmarks ? 'primary' : null;
  });

  const TIER_ORDER = ['novice', 'intermediate', 'advanced', 'elite'];

  const tiersToShow = allBenchmarks
    ? TIER_ORDER
        .filter((tier) => allBenchmarks[tier] != null)
        .map((tier) => [tier, allBenchmarks[tier]!] as [string, KovaaksBenchmarkProgress])
    : benchmarks
      ? [['primary', benchmarks] as [string, KovaaksBenchmarkProgress]]
      : [];

  if (tiersToShow.length === 0) {
    return (
      <div className="bento-card col-span-4 !p-5">
        <div className="flex items-center gap-2 mb-4">
          <Crosshair size={20} className="text-orange-400" />
          <h2 className="text-lg font-semibold">Benchmarks</h2>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No benchmark data available</p>
          <p className="text-gray-600 text-xs mt-1">This user hasn&apos;t completed any Voltaic benchmarks yet</p>
        </div>
      </div>
    );
  }

  const tierLabels: Record<string, string> = {
    novice: 'Novice',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    elite: 'Elite',
    primary: 'Voltaic',
  };

  return (
    <div className="bento-card col-span-4 !p-5">
      <div className="flex items-center gap-2 mb-4">
        <Crosshair size={20} className="text-orange-400" />
        <h2 className="text-lg font-semibold">Benchmarks</h2>
      </div>

      <div className="kvk-benchmarks-list">
        {tiersToShow.map(([tier, data]) => {
          if (!data) return null;
          const isExpanded = expandedTier === tier;

          const tierEnergy = vtEnergy?.[tier] ?? null;
          const energyRankName = tierEnergy?.rankName || 'Unranked';
          const energyRankColor = tierEnergy?.rankColor || '#6b7280';
          const harmonicMean = tierEnergy?.harmonicMean ?? 0;
          const subcategoryEnergyMap = buildSubcategoryEnergyMap(tierEnergy);

          let totalScenarios = 0;
          let completedScenarios = 0;
          for (const category of Object.values(data.categories)) {
            for (const scenario of Object.values(category.scenarios)) {
              totalScenarios++;
              if (scenario.score > 0) completedScenarios++;
            }
          }

          const categoryNames = Object.keys(data.categories);
          // Filter out "No Rank" / "Unranked" from the displayed ranks
          const filteredRankIndices: number[] = [];
          for (let i = 0; i < data.ranks.length; i++) {
            const name = data.ranks[i]?.name?.toLowerCase() || '';
            if (name === 'no rank' || name === 'unranked') continue;
            filteredRankIndices.push(i);
          }
          // Limit to 4 visible rank columns
          const visibleRankIndices = filteredRankIndices.slice(0, 4);

          return (
            <div key={tier} className="kvk-benchmark-tier">
              {/* Tier Header */}
              <button
                className="kvk-benchmark-header"
                onClick={() => setExpandedTier(isExpanded ? null : tier)}
              >
                <div className="kvk-benchmark-header-left">
                  <div className="kvk-benchmark-title">
                    <span className="kvk-benchmark-name">
                      {tierLabels[tier] || 'Voltaic'} Benchmarks
                    </span>
                    {energyRankName !== 'Unranked' && (
                      <span
                        className="kvk-benchmark-rank-badge"
                        style={{ color: energyRankColor, borderColor: `${energyRankColor}40` }}
                      >
                        {energyRankName}
                      </span>
                    )}
                    <span className="kvk-benchmark-completed">
                      {completedScenarios}/{totalScenarios}
                    </span>
                  </div>
                </div>
                <div className="kvk-benchmark-header-right">
                  <div className="kvk-benchmark-volts">
                    <Zap size={12} style={{ color: energyRankColor }} />
                    <span className="kvk-benchmark-volts-value" style={{ color: energyRankColor }}>
                      {harmonicMean > 0 ? harmonicMean.toFixed(1) : '—'}
                    </span>
                    <span className="kvk-benchmark-volts-label">energy</span>
                  </div>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {/* Expanded Content - Voltaic table */}
              {isExpanded && (
                <div className="kvk-benchmark-content">
                  <div className="kvk-table-wrap">
                    <table className="kvk-table">
                      <thead>
                        <tr>
                          <th className="kvk-th kvk-th-cat">Category</th>
                          <th className="kvk-th kvk-th-subcat">Subcategory</th>
                          <th className="kvk-th kvk-th-scenario">Scenario</th>
                          <th className="kvk-th kvk-th-score">Score</th>
                          {visibleRankIndices.map((rankIdx) => {
                            const rank = data.ranks[rankIdx];
                            const rankColor = rank?.color || RANK_COLORS[rank?.name] || '#6b7280';
                            return (
                              <th
                                key={rankIdx}
                                className="kvk-th kvk-th-rank"
                                style={{ color: rankColor }}
                              >
                                {rank?.name}
                              </th>
                            );
                          })}
                          <th className="kvk-th kvk-th-energy">Energy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryNames.map((categoryName) => {
                          const category = data.categories[categoryName];
                          const scenarioEntries = Object.entries(category.scenarios);
                          const subcategoryNames = CATEGORY_SUBCATEGORIES[categoryName] || [];

                          // Build subcategory groups
                          const groups: Array<{
                            subcategoryName: string;
                            scenarios: Array<[string, typeof scenarioEntries[0][1]]>;
                            energy: number;
                          }> = [];

                          let scenarioIdx = 0;
                          for (const subName of subcategoryNames) {
                            const groupScenarios: Array<[string, typeof scenarioEntries[0][1]]> = [];
                            for (let i = 0; i < 2 && scenarioIdx < scenarioEntries.length; i++) {
                              groupScenarios.push(scenarioEntries[scenarioIdx]);
                              scenarioIdx++;
                            }
                            groups.push({
                              subcategoryName: subName,
                              scenarios: groupScenarios,
                              energy: subcategoryEnergyMap[subName]?.energy ?? 0,
                            });
                          }

                          // Fallback if no subcategory mapping
                          if (groups.length === 0) {
                            groups.push({
                              subcategoryName: categoryName,
                              scenarios: scenarioEntries,
                              energy: 0,
                            });
                          }

                          const totalCategoryRows = groups.reduce((s, g) => s + g.scenarios.length, 0);
                          let isFirstCategoryRow = true;

                          return groups.map((group, groupIdx) => {
                            return group.scenarios.map(([scenarioName, scenario], sIdx) => {
                              const isCompleted = scenario.score > 0;
                              // API scores are ×100, convert for display
                              const displayScore = convertApiScore(scenario.score);
                              const scenarioRankColor = getScenarioRankColor(scenario.scenario_rank, data.ranks);
                              const showCategory = isFirstCategoryRow;
                              const showSubcategory = sIdx === 0;
                              const showEnergy = sIdx === 0;

                              if (isFirstCategoryRow) isFirstCategoryRow = false;

                              return (
                                <tr
                                  key={`${categoryName}-${groupIdx}-${sIdx}`}
                                  className={`kvk-tr${showSubcategory ? ' kvk-tr-sub-first' : ''}`}
                                >
                                  {/* Category cell - spans all rows in category */}
                                  {showCategory && (
                                    <td
                                      className="kvk-td kvk-td-cat"
                                      rowSpan={totalCategoryRows}
                                    >
                                      <span className="kvk-cat-label">{categoryName}</span>
                                    </td>
                                  )}

                                  {/* Subcategory cell - spans all rows in subcategory */}
                                  {showSubcategory && (
                                    <td
                                      className="kvk-td kvk-td-subcat"
                                      rowSpan={group.scenarios.length}
                                    >
                                      <span className="kvk-subcat-label">{group.subcategoryName}</span>
                                    </td>
                                  )}

                                  {/* Scenario name */}
                                  <td className="kvk-td kvk-td-scenario" title={scenarioName}>
                                    {scenarioName}
                                  </td>

                                  {/* Score (converted from API ×100 format) */}
                                  <td
                                    className="kvk-td kvk-td-score"
                                    style={{
                                      color: isCompleted ? scenarioRankColor : '#4b5563',
                                      fontWeight: isCompleted ? 600 : 400,
                                    }}
                                  >
                                    {isCompleted ? formatScore(displayScore) : '0'}
                                  </td>

                                  {/* Rank thresholds (skip "No Rank") */}
                                  {visibleRankIndices.map((rankIdx) => {
                                    const threshold = scenario.rank_maxes[rankIdx] ?? 0;
                                    const isAchieved = isCompleted && displayScore >= threshold;
                                    const rankColor = data.ranks[rankIdx]?.color || RANK_COLORS[data.ranks[rankIdx]?.name] || '#6b7280';
                                    return (
                                      <td
                                        key={rankIdx}
                                        className={`kvk-td kvk-td-rank${isAchieved ? ' kvk-td-rank-achieved' : ''}`}
                                        style={isAchieved ? {
                                          color: rankColor,
                                          background: `linear-gradient(135deg, ${rankColor}30 25%, transparent 25%, transparent 50%, ${rankColor}30 50%, ${rankColor}30 75%, transparent 75%)`,
                                          backgroundSize: '6px 6px',
                                        } : undefined}
                                      >
                                        {formatScore(threshold)}
                                      </td>
                                    );
                                  })}

                                  {/* Energy - spans subcategory rows */}
                                  {showEnergy && (
                                    <td
                                      className="kvk-td kvk-td-energy"
                                      rowSpan={group.scenarios.length}
                                      style={{
                                        color: group.energy > 0 ? energyRankColor : '#4b5563',
                                      }}
                                    >
                                      {group.energy > 0 ? group.energy : '—'}
                                    </td>
                                  )}
                                </tr>
                              );
                            });
                          });
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Harmonic Mean Summary */}
                  {tierEnergy && (
                    <div className="kvk-hm-summary">
                      <span className="kvk-hm-label">Harmonic Mean</span>
                      <span className="kvk-hm-value" style={{ color: energyRankColor }}>
                        {harmonicMean > 0 ? harmonicMean.toFixed(1) : '—'}
                      </span>
                      {energyRankName !== 'Unranked' && (
                        <span
                          className="kvk-hm-rank"
                          style={{ color: energyRankColor, borderColor: `${energyRankColor}50` }}
                        >
                          {energyRankName}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
