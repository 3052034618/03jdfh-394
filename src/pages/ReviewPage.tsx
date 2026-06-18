import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import {
  ActType, ACT_LABELS, ACT_DESCRIPTIONS,
  NodeFearRanking, DialogueTree
} from '@/types';
import {
  ChevronLeft, BarChart3, Flame, Users, Trophy, Filter, Play, Eye, ArrowRight,
  Calendar, BookOpen, Skull, Zap, TrendingUp, PieChart, CheckCircle, Copy
} from 'lucide-react';

type ReviewTab = 'ranking' | 'distribution' | 'champions';

export default function ReviewPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const { topics, trees, feedbacks, recoveredSnapshots, findAnyTree, getFeedbacksByTreeId } = useStore();

  const [activeTab, setActiveTab] = useState<ReviewTab>('ranking');
  const [actFilter, setActFilter] = useState<ActType | 'all'>('all');
  const [copied, setCopied] = useState(false);

  const topic = useMemo(() => {
    if (!topicId) return undefined;
    return topics.find(t => t.id === topicId);
  }, [topicId, topics]);

  const treesForTopic = useMemo<DialogueTree[]>(() => {
    if (!topicId) return [];
    const directTrees = trees.filter(t => t.topicId === topicId);
    const recoveredList = Object.values(recoveredSnapshots).filter(
      t => t.topicId === topicId && !directTrees.some(d => d.id === t.id)
    );
    return [...directTrees, ...recoveredList];
  }, [topicId, trees, recoveredSnapshots]);

  const feedbacksForTopic = useMemo(() => {
    const treeIds = new Set(treesForTopic.map(t => t.id));
    return feedbacks.filter(fb => treeIds.has(fb.treeId));
  }, [treesForTopic, feedbacks]);

  const aggregatedRanking = useMemo<NodeFearRanking[]>(() => {
    const marksByNodeId: Record<string, {
      nodeId: string;
      nodeText: string;
      actType: ActType;
      markCount: number;
      reviewerNames: Set<string>;
      treeId: string;
      authorName: string;
    }> = {};

    for (const feedback of feedbacksForTopic) {
      for (const mark of feedback.marks) {
        let nodeInfo = marksByNodeId[mark.nodeId];
        if (!nodeInfo) {
          let nodeText = '';
          let actType: ActType = 'opening';
          let treeId = '';
          let authorName = '匿名作者';

          for (const tree of treesForTopic) {
            for (const act of tree.acts) {
              const node = act.nodes.find(n => n.id === mark.nodeId);
              if (node) {
                nodeText = node.content;
                actType = act.type;
                treeId = tree.id;
                authorName = tree.authorName || '匿名作者';
                break;
              }
            }
            if (nodeText) break;
          }

          if (!nodeText) continue;

          nodeInfo = {
            nodeId: mark.nodeId,
            nodeText,
            actType,
            markCount: 0,
            reviewerNames: new Set(),
            treeId,
            authorName,
          };
          marksByNodeId[mark.nodeId] = nodeInfo;
        }
        nodeInfo.markCount++;
        if (feedback.reviewerName) {
          nodeInfo.reviewerNames.add(feedback.reviewerName);
        }
      }
    }

    return Object.values(marksByNodeId)
      .map(item => ({
        ...item,
        reviewerNames: Array.from(item.reviewerNames),
      }))
      .sort((a, b) => b.markCount - a.markCount);
  }, [feedbacksForTopic, treesForTopic]);

  const totalMarks = useMemo(() => {
    return aggregatedRanking.reduce((sum, item) => sum + item.markCount, 0);
  }, [aggregatedRanking]);

  const maxMarkCount = useMemo(() => {
    return aggregatedRanking.length > 0 ? aggregatedRanking[0].markCount : 1;
  }, [aggregatedRanking]);

  const filteredRanking = useMemo(() => {
    if (actFilter === 'all') return aggregatedRanking;
    return aggregatedRanking.filter(item => item.actType === actFilter);
  }, [aggregatedRanking, actFilter]);

  const treeDistributions = useMemo(() => {
    return treesForTopic.map(tree => {
      const treeFeedbacks = getFeedbacksByTreeId(tree.id);
      const totalTreeMarks = treeFeedbacks.reduce((sum, fb) => sum + fb.marks.length, 0);
      
      const actMarks: Record<ActType, number> = { opening: 0, anomaly: 0, collapse: 0 };
      const nodeCounts: Record<string, number> = {};
      
      for (const fb of treeFeedbacks) {
        for (const mark of fb.marks) {
          nodeCounts[mark.nodeId] = (nodeCounts[mark.nodeId] || 0) + 1;
          for (const act of tree.acts) {
            const node = act.nodes.find(n => n.id === mark.nodeId);
            if (node) {
              actMarks[act.type]++;
              break;
            }
          }
        }
      }

      const topNodeEntry = Object.entries(nodeCounts).sort((a, b) => b[1] - a[1])[0];
      let topNodeText = '';
      let topNodeCount = 0;
      
      if (topNodeEntry) {
        topNodeCount = topNodeEntry[1];
        for (const act of tree.acts) {
          const node = act.nodes.find(n => n.id === topNodeEntry[0]);
          if (node) {
            topNodeText = node.content;
            break;
          }
        }
      }

      return {
        tree,
        feedbackCount: treeFeedbacks.length,
        totalMarks: totalTreeMarks,
        actMarks,
        topNodeText,
        topNodeCount,
      };
    }).sort((a, b) => b.totalMarks - a.totalMarks);
  }, [treesForTopic, getFeedbacksByTreeId]);

  const actChampions = useMemo(() => {
    const acts: ActType[] = ['opening', 'anomaly', 'collapse'];
    return acts.map(actType => ({
      actType,
      topNodes: aggregatedRanking
        .filter(item => item.actType === actType)
        .slice(0, 3),
    }));
  }, [aggregatedRanking]);

  const copyTopicUrl = () => {
    if (!topicId) return;
    const url = `${window.location.origin}/editor/${topicId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getActColorClass = (actType: ActType) => {
    switch (actType) {
      case 'opening': return 'bg-green-900/30 text-green-400 border-green-700/50';
      case 'anomaly': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/50';
      case 'collapse': return 'bg-red-900/30 text-red-400 border-red-700/50';
    }
  };

  const getActBorderClass = (actType: ActType) => {
    switch (actType) {
      case 'opening': return 'border-l-green-500';
      case 'anomaly': return 'border-l-yellow-500';
      case 'collapse': return 'border-l-red-500';
    }
  };

  if (!topic) {
    return (
      <div className="min-h-screen bg-horror-bg animate-fade-in">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <button
            className="horror-btn-ghost mb-6 text-sm flex items-center gap-1"
            onClick={() => navigate('/')}
          >
            <ChevronLeft className="h-4 w-4" />
            返回题目汇总
          </button>
          <div className="horror-card text-center py-16">
            <Skull className="mx-auto mb-4 h-12 w-12 text-horror-rust/50" />
            <div className="text-xl text-horror-muted mb-2">题目未找到</div>
            <div className="text-sm text-horror-muted/70 mb-6">
              该题目可能已被删除或不存在
            </div>
            <button
              className="horror-btn-primary"
              onClick={() => navigate('/')}
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  const firstTreeId = treesForTopic[0]?.id;

  return (
    <div className="min-h-screen bg-horror-bg animate-fade-in">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <button
            className="horror-btn-ghost text-sm flex items-center gap-1"
            onClick={() => navigate('/')}
          >
            <ChevronLeft className="h-4 w-4" />
            返回题目汇总
          </button>
          <div className="flex items-center gap-2">
            {firstTreeId && (
              <button
                className="horror-btn-ghost text-sm flex items-center gap-1"
                onClick={() => navigate(`/stats/${firstTreeId}`)}
              >
                <BarChart3 className="h-4 w-4" />
                📊 单个作品统计
              </button>
            )}
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-6 w-6 text-horror-rust" />
            <span className="text-lg text-horror-muted">课程复盘</span>
          </div>
          <h1 className="font-creep text-4xl text-horror-rust mb-2">
            {topic.title}
          </h1>
          {topic.scenario && (
            <p className="text-sm text-horror-muted/80 max-w-2xl">
              {topic.scenario}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="horror-card text-center">
            <Users className="mx-auto mb-2 h-7 w-7 text-horror-rust" />
            <div className="text-2xl font-bold text-horror-text mb-1">{treesForTopic.length}</div>
            <div className="text-xs text-horror-muted">参与作品数</div>
          </div>
          <div className="horror-card text-center">
            <PieChart className="mx-auto mb-2 h-7 w-7 text-horror-rust" />
            <div className="text-2xl font-bold text-horror-text mb-1">{feedbacksForTopic.length}</div>
            <div className="text-xs text-horror-muted">总反馈数</div>
          </div>
          <div className="horror-card text-center">
            <Flame className="mx-auto mb-2 h-7 w-7 text-horror-rust" />
            <div className="text-2xl font-bold text-horror-text mb-1">{totalMarks}</div>
            <div className="text-xs text-horror-muted">总恐惧标记</div>
          </div>
          <div className="horror-card text-center">
            <Trophy className="mx-auto mb-2 h-7 w-7 text-horror-rust" />
            <div className="text-lg font-bold text-horror-text mb-1 truncate px-1">
              {aggregatedRanking[0] ? `${aggregatedRanking[0].markCount}次标记` : '暂无'}
            </div>
            <div className="text-xs text-horror-muted">班级最恐惧节点</div>
          </div>
        </div>

        {treesForTopic.length === 0 ? (
          <div className="horror-card text-center py-12">
            <Skull className="mx-auto mb-4 h-10 w-10 text-horror-muted/50" />
            <div className="text-lg text-horror-muted mb-2">此题目下还没有学生作品</div>
            <div className="text-sm text-horror-muted/70 mb-4">
              把题目链接发给学生，让他们开始创作吧
            </div>
            <button
              className="horror-btn-primary text-sm inline-flex items-center gap-1.5"
              onClick={copyTopicUrl}
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  已复制链接
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  复制题目链接
                </>
              )}
            </button>
          </div>
        ) : feedbacksForTopic.length === 0 ? (
          <div className="horror-card text-center py-12">
            <Eye className="mx-auto mb-4 h-10 w-10 text-horror-muted/50" />
            <div className="text-lg text-horror-muted mb-2">还没有收到反馈</div>
            <div className="text-sm text-horror-muted/70 mb-4">
              把作品链接发给同学试试，让他们标记恐惧点
            </div>
            <button
              className="horror-btn-primary text-sm inline-flex items-center gap-1.5"
              onClick={copyTopicUrl}
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  已复制链接
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  复制题目链接
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap gap-2">
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  actFilter === 'all'
                    ? 'bg-horror-rust text-white'
                    : 'text-horror-muted hover:text-horror-text hover:bg-horror-card-hover'
                }`}
                onClick={() => setActFilter('all')}
              >
                🗂️ 全部
              </button>
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  actFilter === 'opening'
                    ? 'bg-horror-rust text-white'
                    : 'text-horror-muted hover:text-horror-text hover:bg-horror-card-hover'
                }`}
                onClick={() => setActFilter('opening')}
              >
                🟢 {ACT_LABELS.opening}
              </button>
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  actFilter === 'anomaly'
                    ? 'bg-horror-rust text-white'
                    : 'text-horror-muted hover:text-horror-text hover:bg-horror-card-hover'
                }`}
                onClick={() => setActFilter('anomaly')}
              >
                🟡 {ACT_LABELS.anomaly}
              </button>
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  actFilter === 'collapse'
                    ? 'bg-horror-rust text-white'
                    : 'text-horror-muted hover:text-horror-text hover:bg-horror-card-hover'
                }`}
                onClick={() => setActFilter('collapse')}
              >
                🔴 {ACT_LABELS.collapse}
              </button>
            </div>

            <div className="mb-6 flex justify-center gap-2 border-b border-horror-border/50">
              <button
                className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'ranking'
                    ? 'text-horror-rust border-horror-rust'
                    : 'text-horror-muted border-transparent hover:text-horror-text'
                }`}
                onClick={() => setActiveTab('ranking')}
              >
                🔥 恐惧热点排行
              </button>
              <button
                className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'distribution'
                    ? 'text-horror-rust border-horror-rust'
                    : 'text-horror-muted border-transparent hover:text-horror-text'
                }`}
                onClick={() => setActiveTab('distribution')}
              >
                📊 按作品分布
              </button>
              <button
                className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'champions'
                    ? 'text-horror-rust border-horror-rust'
                    : 'text-horror-muted border-transparent hover:text-horror-text'
                }`}
                onClick={() => setActiveTab('champions')}
              >
                🏆 各幕冠军
              </button>
            </div>

            {activeTab === 'ranking' && (
              <div className="space-y-4 animate-slide-in-up">
                {filteredRanking.length === 0 ? (
                  <div className="horror-card text-center py-8 text-horror-muted">
                    此分类下暂无恐惧标记数据
                  </div>
                ) : (
                  filteredRanking.slice(0, 50).map((item, index) => {
                    const heatPct = maxMarkCount > 0 ? (item.markCount / maxMarkCount) * 100 : 0;
                    const pct = totalMarks > 0 ? Math.round((item.markCount / totalMarks) * 100) : 0;
                    const medalIcon = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;

                    return (
                      <div
                        key={item.nodeId}
                        className="horror-card hover:scale-[1.01] transition-transform border-l-4"
                        style={{ borderLeftColor: item.actType === 'opening' ? '#22c55e' : item.actType === 'anomaly' ? '#eab308' : '#ef4444' }}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="shrink-0 w-10 text-center pt-1">
                            {medalIcon ? (
                              <span className="text-2xl">{medalIcon}</span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-horror-card-hover text-horror-muted text-xs font-bold">
                                #{index + 1}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${getActColorClass(item.actType)}`}>
                                {ACT_LABELS[item.actType]}
                              </span>
                              <button
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-horror-card-hover text-[11px] text-horror-muted hover:text-horror-text transition-colors"
                                onClick={() => navigate(`/stats/${item.treeId}#${item.nodeId}`)}
                              >
                                👤 {item.authorName}
                              </button>
                            </div>
                            <div className="font-mono text-sm text-horror-text/90 mb-3 max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                              {item.nodeText}
                            </div>
                            <div className="mb-3 h-2 rounded-full bg-horror-card-hover overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-horror-rust/60 to-horror-rust transition-all"
                                style={{ width: `${heatPct}%` }}
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-horror-muted">
                              <span className="inline-flex items-center gap-1">
                                <Flame className="h-3.5 w-3.5 text-horror-rust" />
                                {item.markCount} 次标记
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {item.reviewerNames.length} 位同学
                              </span>
                              <span>
                                占班级标记 {pct}%
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0">
                            <button
                              className="horror-btn-primary text-xs px-3 py-2 flex items-center gap-1"
                              onClick={() => navigate(`/stats/${item.treeId}?node=${item.nodeId}`)}
                            >
                              查看作品详情
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'distribution' && (
              <div className="space-y-4 animate-slide-in-up">
                {treeDistributions.map(({ tree, feedbackCount, totalMarks, actMarks, topNodeText, topNodeCount }) => {
                  const maxActMarks = Math.max(...Object.values(actMarks), 1);
                  return (
                    <div key={tree.id} className="horror-card">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Eye className="h-4 w-4 text-horror-rust" />
                            <span className="font-medium text-horror-text">
                              {tree.authorName || '匿名作者'}
                            </span>
                          </div>
                          <div className="text-xs text-horror-muted">
                            创建于 {new Date(tree.createdAt).toLocaleDateString('zh-CN')}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="inline-flex items-center gap-1 rounded-full bg-horror-card-hover px-2.5 py-1 text-xs text-horror-muted">
                            <Flame className="h-3.5 w-3.5 text-horror-rust" />
                            {totalMarks}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-horror-card-hover px-2.5 py-1 text-xs text-horror-muted">
                            <BarChart3 className="h-3.5 w-3.5" />
                            {feedbackCount} 份反馈
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {(['opening', 'anomaly', 'collapse'] as ActType[]).map(actType => (
                          <div key={actType} className="rounded-lg bg-horror-card-hover/50 p-2">
                            <div className="text-[10px] text-horror-muted mb-1">{ACT_LABELS[actType]}</div>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 rounded-full bg-horror-bg overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    actType === 'opening' ? 'bg-green-500' :
                                    actType === 'anomaly' ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${(actMarks[actType] / maxActMarks) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-horror-text font-medium w-6 text-right">
                                {actMarks[actType]}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {topNodeText && (
                        <div className="mb-4 p-3 rounded-lg bg-horror-card-hover/30 border border-horror-border/30">
                          <div className="text-[11px] text-horror-muted mb-1">最恐惧节点</div>
                          <div className="text-sm text-horror-text/90 line-clamp-2">
                            {topNodeText}
                          </div>
                          <div className="text-xs text-horror-rust mt-1">
                            <Flame className="h-3 w-3 inline mr-1" />
                            {topNodeCount} 次标记
                          </div>
                        </div>
                      )}

                      <button
                        className="horror-btn-primary w-full text-sm flex items-center justify-center gap-2"
                        onClick={() => navigate(`/stats/${tree.id}`)}
                      >
                        <BarChart3 className="h-4 w-4" />
                        📊 查看完整统计
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'champions' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-in-up">
                {actChampions.map(({ actType, topNodes }) => (
                  <div
                    key={actType}
                    className={`horror-card border-l-4 ${getActBorderClass(actType)}`}
                  >
                    <div className="mb-4">
                      <h3 className="font-medium text-horror-text mb-1">
                        {ACT_LABELS[actType]}
                      </h3>
                      <p className="text-xs text-horror-muted">
                        {ACT_DESCRIPTIONS[actType]}
                      </p>
                    </div>
                    <div className="space-y-3">
                      {topNodes.length === 0 ? (
                        <div className="text-sm text-horror-muted/60 text-center py-4">
                          暂无数据
                        </div>
                      ) : (
                        topNodes.map((item, idx) => {
                          const medal = idx === 0 ? '🏆' : idx === 1 ? '🥈' : '🥉';
                          return (
                            <button
                              key={item.nodeId}
                              className="w-full text-left p-2 rounded-lg hover:bg-horror-card-hover transition-colors group"
                              onClick={() => navigate(`/stats/${item.treeId}`)}
                            >
                              <div className="flex items-start gap-2">
                                <span className="text-lg shrink-0">{medal}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm text-horror-text/90 line-clamp-2 mb-1 group-hover:text-horror-text transition-colors">
                                    {item.nodeText.slice(0, 30)}{item.nodeText.length > 30 ? '...' : ''}
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] text-horror-muted">
                                    <span className="inline-flex items-center gap-1">
                                      <Flame className="h-3 w-3 text-horror-rust" />
                                      {item.markCount}次
                                    </span>
                                    <span>👤 {item.authorName}</span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
