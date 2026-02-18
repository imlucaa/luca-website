'use client';

import { useState } from 'react';
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

// Voltaic S5 category colors
const CATEGORY_COLORS: Record<string, string> = {
  'Clicking': '#CC0000',
  'Tracking': '#1155CC',
  'Switching': '#351C75',
};

// Voltaic S5 subcategory colors
const SUBCATEGORY_COLORS: Record<string, string> = {
  'Dynamic': '#F1C232',
  'Static': '#E06666',
  'Linear': '#FF8A45',
  'Precise': '#45818E',
  'Reactive': '#3C78D8',
  'Control': '#42A5FF',
  'Speed': '#A64D79',
  'Evasive': '#674EA7',
  'Stability': '#B4A3FF',
};

interface KovaaksBenchmarksProps {
  benchmarks: KovaaksBenchmarkProgress | null;
  allBenchmarks?: Record<string, KovaaksBenchmarkProgress | null>;
  vtEnergy?: Record<string, KovaaksVtEnergyResult | null>;
}

/**
 * The KoVaaK's API returns scores multiplied by 100.
 * Convert to the real display value (divide by 100), rounded to integer.
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

function getRankColor(rankIdx: number, ranks: KovaaksBenchmarkProgress['ranks']): string {
  if (rankIdx < 0 || rankIdx >= ranks.length) return RANK_COLORS['Unranked'];
  const rank = ranks[rankIdx];
  const name = rank?.name || 'Unranked';
  // Prefer our RANK_COLORS map (Voltaic metadata) over API color
  // Try exact match first, then title-case match
  const titleCase = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  return RANK_COLORS[name] || RANK_COLORS[titleCase] || rank?.color || RANK_COLORS['Unranked'];
}

function getEnergyRankColor(energyRankName: string): string {
  return RANK_COLORS[energyRankName] || RANK_COLORS['Unranked'];
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

/**
 * Determine which rank a scenario's score has achieved.
 * Returns the highest rankArrayIdx where score >= threshold, or -1 if none.
 * Uses rankMaxesIdx to look up the correct threshold from rank_maxes.
 */
function getAchievedRankIdx(
  scenario: { score: number; rank_maxes: number[] },
  displayRanks: Array<{ rankArrayIdx: number; rankMaxesIdx: number }>
): number {
  if (scenario.score <= 0) return -1;
  const displayScore = convertApiScore(scenario.score);
  let highest = -1;
  for (const { rankArrayIdx, rankMaxesIdx } of displayRanks) {
    const threshold = scenario.rank_maxes[rankMaxesIdx] ?? 0;
    if (threshold > 0 && displayScore >= threshold) {
      highest = rankArrayIdx;
    }
  }
  return highest;
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
        <h2 className="text-lg font-semibold">Benchmarks</h2>
      </div>

      <div className="kvk-benchmarks-list">
        {tiersToShow.map(([tier, data]) => {
          if (!data) return null;
          const isExpanded = expandedTier === tier;

          const tierEnergy = vtEnergy?.[tier] ?? null;
          const energyRankName = tierEnergy?.rankName || 'Unranked';
          const energyRankColor = getEnergyRankColor(energyRankName);
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
          // Build visible ranks: pair each actual rank with its rank_maxes index.
          // The ranks array may start with "No Rank"/"Unranked" which has no
          // corresponding entry in scenario.rank_maxes. rank_maxes is 0-indexed
          // for actual ranks only (Iron=0, Bronze=1, Silver=2, Gold=3, etc.).
          const visibleRanks: Array<{ rankArrayIdx: number; rankMaxesIdx: number }> = [];
          let rankMaxesCounter = 0;
          for (let i = 0; i < data.ranks.length; i++) {
            const name = data.ranks[i]?.name?.toLowerCase() || '';
            if (name === 'no rank' || name === 'unranked') continue;
            visibleRanks.push({ rankArrayIdx: i, rankMaxesIdx: rankMaxesCounter });
            rankMaxesCounter++;
          }
          // Limit visible rank columns (6 for elite, 4 for others)
          const displayRanks = visibleRanks.slice(0, 6);

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
                        style={{
                          color: energyRankColor,
                          borderColor: energyRankColor + '40',
                          background: energyRankColor + '15',
                        }}
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
                    <span
                      className="kvk-benchmark-volts-value"
                      style={{ color: energyRankName !== 'Unranked' ? energyRankColor : '#fff' }}
                    >
                      {harmonicMean > 0 ? harmonicMean.toFixed(1) : '—'}
                    </span>
                    <span className="kvk-benchmark-volts-label">energy</span>
                  </div>
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
                          {displayRanks.map(({ rankArrayIdx }) => {
                            const rank = data.ranks[rankArrayIdx];
                            const rankColor = rank?.color || RANK_COLORS[rank?.name || 'Unranked'] || '#6b7280';
                            return (
                              <th
                                key={rankArrayIdx}
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
                          const categoryColor = CATEGORY_COLORS[categoryName] || '#6b7280';

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
                            const subcategoryColor = SUBCATEGORY_COLORS[group.subcategoryName] || '#6b7280';

                            return group.scenarios.map(([scenarioName, scenario], sIdx) => {
                              const isCompleted = scenario.score > 0;
                              const displayScore = convertApiScore(scenario.score);
                              const showCategory = isFirstCategoryRow;
                              const showSubcategory = sIdx === 0;
                              const showEnergy = sIdx === 0;
                              const achievedRankIdx = getAchievedRankIdx(scenario, displayRanks);
                              const achievedRankColor = achievedRankIdx >= 0
                                ? getRankColor(achievedRankIdx, data.ranks)
                                : undefined;

                              if (isFirstCategoryRow) isFirstCategoryRow = false;

                              return (
                                <tr
                                  key={`${categoryName}-${groupIdx}-${sIdx}`}
                                  className={`kvk-tr${showSubcategory ? ' kvk-tr-sub-first' : ''}`}
                                >
                                  {/* Category cell - colored */}
                                  {showCategory && (
                                    <td
                                      className="kvk-td kvk-td-cat"
                                      rowSpan={totalCategoryRows}
                                      style={{ borderRightColor: categoryColor + '40' }}
                                    >
                                      <span
                                        className="kvk-cat-label"
                                        style={{ color: categoryColor }}
                                      >
                                        {categoryName}
                                      </span>
                                    </td>
                                  )}

                                  {/* Subcategory cell - colored */}
                                  {showSubcategory && (
                                    <td
                                      className="kvk-td kvk-td-subcat"
                                      rowSpan={group.scenarios.length}
                                      style={{ borderRightColor: subcategoryColor + '30' }}
                                    >
                                      <span
                                        className="kvk-subcat-label"
                                        style={{ color: subcategoryColor }}
                                      >
                                        {group.subcategoryName}
                                      </span>
                                    </td>
                                  )}

                                  {/* Scenario name */}
                                  <td className="kvk-td kvk-td-scenario" title={scenarioName}>
                                    {scenarioName}
                                  </td>

                                  {/* Score - colored by achieved rank with diagonal fill */}
                                  <td
                                    className={`kvk-td kvk-td-score${isCompleted && achievedRankColor ? ' kvk-td-rank-achieved' : ''}`}
                                    style={{
                                      color: isCompleted ? '#fff' : '#4b5563',
                                      fontWeight: isCompleted ? 600 : 400,
                                      ...(isCompleted && achievedRankColor ? {
                                        background: `linear-gradient(135deg, ${achievedRankColor}90 0%, ${achievedRankColor}50 40%, ${achievedRankColor}20 100%)`,
                                        borderLeft: `2px solid ${achievedRankColor}cc`,
                                      } : {}),
                                    }}
                                  >
                                    {isCompleted ? formatScore(displayScore) : '—'}
                                  </td>

                                  {/* Rank thresholds with diagonal gradient */}
                                  {displayRanks.map(({ rankArrayIdx, rankMaxesIdx }) => {
                                    const threshold = scenario.rank_maxes[rankMaxesIdx] ?? 0;
                                    const isAchieved = isCompleted && threshold > 0 && displayScore >= threshold;
                                    const rankColor = getRankColor(rankArrayIdx, data.ranks);
                                    return (
                                      <td
                                        key={rankArrayIdx}
                                        className={`kvk-td kvk-td-rank${isAchieved ? ' kvk-td-rank-achieved' : ''}`}
                                        style={{
                                          background: isAchieved
                                            ? `linear-gradient(135deg, ${rankColor}90 0%, ${rankColor}50 40%, ${rankColor}20 100%)`
                                            : `linear-gradient(135deg, ${rankColor}18 0%, ${rankColor}08 60%, transparent 100%)`,
                                          color: isAchieved ? '#fff' : rankColor + '55',
                                          borderLeft: `2px solid ${isAchieved ? rankColor + 'cc' : rankColor + '18'}`,
                                        }}
                                      >
                                        {formatScore(threshold)}
                                      </td>
                                    );
                                  })}

                                  {/* Energy */}
                                  {showEnergy && (
                                    <td
                                      className="kvk-td kvk-td-energy"
                                      rowSpan={group.scenarios.length}
                                      style={{
                                        color: group.energy > 0 ? '#e5e7eb' : '#4b5563',
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

                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
