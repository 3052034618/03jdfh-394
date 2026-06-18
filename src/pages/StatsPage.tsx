import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import type {
  DialogueTree,
  StatsNodeRow,
  ReviewerRow,
  StatsTab,
} from '@/types';
import { ACT_LABELS } from '@/types';
import {
  Skull,
  ArrowLeft,
  BarChart3,
  Users,
  Trophy,
  Flame,
  User,
  Calendar,
  Play,
  Eye,
} from 'lucide-react';

export default function StatsPage() {
  const { id: treeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { findAnyTree, getFeedbacksByTreeId } = useStore();

  const [tab, setTab] = useState<StatsTab>('heatmap');

  const tree = useMemo<DialogueTree | null>(() => {
    if (!treeId) return null;
    return findAnyTree(treeId);
  }, [treeId, findAnyTree]);

  const feedbacks = useMemo(() => {
    if (!treeId) return [];
    return getFeedbacksByTreeId(treeId);
  }, [treeId, getFeedbacksByTreeId]);

  const flatNodes = useMemo(() => {
    if (!tree) return [];
    const sortedActs = [...tree.acts].sort((a, b) => a.order - b.order);
    const nodes: Array<{ actType: typeof sortedActs[number]['type']; node: typeof sortedActs[number]['nodes'][number]; globalIndex: number }> = [];
    let idx = 1;
    for (const act of sortedActs) {
      for (const node of act.nodes) {
        nodes.push({ actType: act.type, node, globalIndex: idx });
        idx++;
      }
    }
    return nodes;
  }, [tree]);

  const nodeMarkMap = useMemo<Record<string, Array<{ name: string; timestamp: number }>>>(() => {
    const map: Record<string, Array<{ name: string; timestamp: number }>> = {};
    for (const fb of feedbacks) {
      for (const mark of fb.marks) {
        if (!map[mark.nodeId]) map[mark.nodeId] = [];
        map[mark.nodeId].push({
          name: fb.reviewerName || '匿名',
          timestamp: fb.playedAt,
        });
      }
    }
    return map;
  }, [feedbacks]);

  const totalMarks = useMemo(() => {
    let count = 0;
    for (const fb of feedbacks) {
      count += fb.marks.length;
    }
    return count;
  }, [feedbacks]);

  const heatmapRows = useMemo<StatsNodeRow[]>(() => {
    return flatNodes.map(({ actType, node, globalIndex }) => ({
      globalIndex,
      nodeId: node.id,
      actType,
      speaker: node.speaker,
      content: node.content,
      markCount: nodeMarkMap[node.id]?.length || 0,
      reviewers: nodeMarkMap[node.id] || [],
    }));
  }, [flatNodes, nodeMarkMap]);

  const topRankedRows = useMemo(() => {
    return [...heatmapRows]
      .filter((r) => r.markCount > 0)
      .sort((a, b) => b.markCount - a.markCount);
  }, [heatmapRows]);

  const maxMarkCount = useMemo(() => {
    return topRankedRows.length > 0 ? topRankedRows[0].markCount : 1;
  }, [topRankedRows]);

  const reviewerRows = useMemo<ReviewerRow[]>(() => {
    const rows: ReviewerRow[] = feedbacks.map((fb) => ({
      name: fb.reviewerName || '匿名评审',
      playedAt: fb.playedAt,
      marksCount: fb.marks.length,
      markedNodeIds: fb.marks.map((m) => m.nodeId),
    }));
    return rows.sort((a, b) => b.marksCount - a.marksCount);
  }, [feedbacks]);

  const uniqueReviewerCount = useMemo(() => {
    const names = new Set<string>();
    for (const fb of feedbacks) {
      names.add(fb.reviewerName || '匿名');
    }
    return names.size;
  }, [feedbacks]);

  const formatDateTime = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!tree) {
    return (
      <div className="min-h-screen bg-horror-bg">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <button
            className="horror-btn-ghost mb-6 text-sm flex items-center gap-1"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </button>
          <div className="horror-card text-center py-16">
            <Skull className="mx-auto mb-4 h-12 w-12 text-horror-rust/50" />
            <div className="text-xl text-horror-muted mb-2">作品未找到</div>
            <div className="text-sm text-horror-muted/70 mb-6">
              该作品可能尚未同步到此设备，需要通过反馈码导入才能恢复
            </div>
            <button
              className="horror-btn-primary"
              onClick={() => navigate('/')}
            >
              返回首页导入反馈
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-horror-bg animate-fade-in">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <button
            className="horror-btn-ghost text-sm flex items-center gap-1"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </button>
          <div className="flex items-center gap-2">
            <button
              className="horror-btn-ghost text-sm flex items-center gap-1"
              onClick={() => navigate(`/editor/${tree.id}`)}
            >
              <Eye className="h-4 w-4" />
              查看作品
            </button>
            <button
              className="horror-btn-ghost text-sm flex items-center gap-1"
              onClick={() => navigate(`/play/${tree.id}`)}
            >
              <Play className="h-4 w-4" />
              回放
            </button>
          </div>
        </div>

        <div className="horror-card mb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="text-xs text-horror-muted mb-1">作品统计</div>
              <h1 className="font-creep text-3xl text-horror-rust mb-2">
                {tree.authorName || '匿名作者'}
              </h1>
              <div className="text-xs text-horror-muted">
                创建于 {formatDateTime(tree.createdAt)}
              </div>
            </div>
            <Skull className="h-10 w-10 text-horror-rust/60 shrink-0" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-horror-border/50">
            <div className="text-center">
              <Users className="mx-auto mb-1 h-6 w-6 text-horror-rust" />
              <div className="text-xl font-bold text-horror-text">{feedbacks.length}</div>
              <div className="text-xs text-horror-muted">份反馈</div>
            </div>
            <div className="text-center">
              <User className="mx-auto mb-1 h-6 w-6 text-horror-rust" />
              <div className="text-xl font-bold text-horror-text">{uniqueReviewerCount}</div>
              <div className="text-xs text-horror-muted">位评审人</div>
            </div>
            <div className="text-center">
              <Flame className="mx-auto mb-1 h-6 w-6 text-horror-rust" />
              <div className="text-xl font-bold text-horror-text">{totalMarks}</div>
              <div className="text-xs text-horror-muted">恐惧标记</div>
            </div>
            <div className="text-center">
              <BarChart3 className="mx-auto mb-1 h-6 w-6 text-horror-rust" />
              <div className="text-xl font-bold text-horror-text">{flatNodes.length}</div>
              <div className="text-xs text-horror-muted">条对白</div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex gap-2 border-b border-horror-border/50">
          <button
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === 'heatmap' ? 'text-horror-rust' : 'text-horror-muted hover:text-horror-text'
            }`}
            onClick={() => setTab('heatmap')}
          >
            <span className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              恐惧热力表
            </span>
            {tab === 'heatmap' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-horror-rust" />
            )}
          </button>
          <button
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === 'reviewers' ? 'text-horror-rust' : 'text-horror-muted hover:text-horror-text'
            }`}
            onClick={() => setTab('reviewers')}
          >
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              评审人列表 ({reviewerRows.length})
            </span>
            {tab === 'reviewers' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-horror-rust" />
            )}
          </button>
          <button
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === 'ranking' ? 'text-horror-rust' : 'text-horror-muted hover:text-horror-text'
            }`}
            onClick={() => setTab('ranking')}
          >
            <span className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4" />
              恐惧排行 Top
            </span>
            {tab === 'ranking' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-horror-rust" />
            )}
          </button>
        </div>

        {tab === 'heatmap' && (
          <div className="space-y-2">
            {heatmapRows.length === 0 ? (
              <div className="horror-card text-center py-8 text-horror-muted">
                此作品暂无对白内容
              </div>
            ) : (
              heatmapRows.map((row) => {
                const heatPct = maxMarkCount > 0 ? (row.markCount / maxMarkCount) * 100 : 0;
                const intensityColor =
                  row.markCount === 0
                    ? 'bg-horror-card-hover/30'
                    : heatPct < 34
                    ? 'bg-yellow-900/20'
                    : heatPct < 67
                    ? 'bg-orange-900/30'
                    : 'bg-red-900/40';
                return (
                  <div
                    key={row.nodeId}
                    className={`horror-card transition-all ${intensityColor}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 w-12 text-center">
                        <div className="text-xs text-horror-muted mb-1">#{row.globalIndex}</div>
                        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-horror-card-hover text-horror-muted">
                          {ACT_LABELS[row.actType]}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              row.speaker === 'npc'
                                ? 'bg-horror-rust/15 text-horror-rust'
                                : 'bg-horror-muted/20 text-horror-muted'
                            }`}
                          >
                            {row.speaker === 'npc' ? '角色' : '旁白'}
                          </span>
                          {row.markCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-horror-rust font-medium">
                              <Flame className="h-3 w-3" />
                              {row.markCount}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-horror-text/90 whitespace-pre-wrap leading-relaxed">
                          {row.content || '(空内容)'}
                        </div>
                        {row.reviewers.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-horror-border/30">
                            <div className="flex flex-wrap gap-1.5">
                              {row.reviewers.slice(0, 6).map((r, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-horror-card-hover text-horror-muted"
                                  title={formatDateTime(r.timestamp)}
                                >
                                  {r.name}
                                </span>
                              ))}
                              {row.reviewers.length > 6 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-horror-card-hover text-horror-muted">
                                  +{row.reviewers.length - 6}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'reviewers' && (
          <div className="space-y-2">
            {reviewerRows.length === 0 ? (
              <div className="horror-card text-center py-8 text-horror-muted">
                暂无评审反馈
              </div>
            ) : (
              reviewerRows.map((row, idx) => (
                <div key={idx} className="horror-card">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-horror-rust/15 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-horror-rust" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-horror-text truncate">
                          {row.name}
                        </div>
                        <div className="text-xs text-horror-muted flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateTime(row.playedAt)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center gap-1 rounded-full bg-horror-rust/15 px-2.5 py-1 text-xs text-horror-rust font-medium">
                        <Flame className="h-3 w-3" />
                        {row.marksCount} 标记
                      </div>
                    </div>
                  </div>
                  {row.markedNodeIds.length > 0 && (
                    <div className="pt-3 border-t border-horror-border/30">
                      <div className="text-xs text-horror-muted mb-2">标记的对白节点</div>
                      <div className="flex flex-wrap gap-1.5">
                        {row.markedNodeIds.map((nid) => {
                          const found = flatNodes.find((f) => f.node.id === nid);
                          const label = found
                            ? `#${found.globalIndex} ${found.node.content.slice(0, 15)}${found.node.content.length > 15 ? '...' : ''}`
                            : nid.slice(0, 8);
                          return (
                            <span
                              key={nid}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-horror-card-hover text-horror-muted/90"
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'ranking' && (
          <div className="space-y-3">
            {topRankedRows.length === 0 ? (
              <div className="horror-card text-center py-8 text-horror-muted">
                暂无恐惧标记数据
              </div>
            ) : (
              topRankedRows.map((row, idx) => {
                const medalIcon = idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                const heatPct = maxMarkCount > 0 ? (row.markCount / maxMarkCount) * 100 : 0;
                return (
                  <div key={row.nodeId} className="horror-card">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 w-10 text-center pt-1">
                        {medalIcon ? (
                          <span className="text-2xl">{medalIcon}</span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-horror-card-hover text-horror-muted text-xs font-bold">
                            #{idx + 1}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-horror-rust/15 text-horror-rust text-[11px] font-medium">
                            {ACT_LABELS[row.actType]}
                          </span>
                          <span className="text-[10px] text-horror-muted">
                            对白 #{row.globalIndex}
                          </span>
                        </div>
                        <div className="text-sm text-horror-text/90 mb-3 whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto">
                          {row.content || '(空内容)'}
                        </div>
                        <div className="mb-3 flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-horror-card-hover overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-horror-rust/60 to-horror-rust transition-all"
                              style={{ width: `${heatPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-horror-muted w-10 text-right">
                            {Math.round(heatPct)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3 text-xs text-horror-muted">
                            <span className="inline-flex items-center gap-1 text-horror-rust font-medium">
                              <Flame className="h-3.5 w-3.5" />
                              {row.markCount} 标记
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {row.reviewers.length} 人
                            </span>
                          </div>
                        </div>
                        {row.reviewers.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-horror-border/30 flex flex-wrap gap-1.5">
                            {row.reviewers.map((r, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-horror-card-hover text-horror-muted"
                                title={formatDateTime(r.timestamp)}
                              >
                                {r.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
