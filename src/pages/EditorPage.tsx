import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { ActType, DialogueNode, PlayerChoice, ACT_LABELS, ACT_DESCRIPTIONS } from '@/types';
import type { HintItem, PlaybackFeedback } from '@/types';
import { generateId, encodeTreeToUrl, decodeFeedbackCode } from '@/utils';
import { analyzeDialogueTree } from '@/analyze';
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Share2,
  Eye,
  MessageCircle,
  Ghost,
  Brain,
  Zap,
  GitBranch,
  Copy,
  Download,
  Check,
} from 'lucide-react';

const ACT_ORDER: ActType[] = ['opening', 'anomaly', 'collapse'];

const CATEGORY_LABELS: Record<HintItem['category'], string> = {
  repeat: '重复检测',
  overexplain: '过度解释',
  emotion: '情绪后果',
  structure: '结构检查',
};

export default function EditorPage() {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useStore();

  const [currentAct, setCurrentAct] = useState<ActType>('opening');
  const [showHints, setShowHints] = useState(false);
  const [copied, setCopied] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2500);
  }, []);

  const tree = useMemo(() => {
    if (!paramId) return undefined;
    return store.getTreeById(paramId) || store.getTreeByTopicId(paramId);
  }, [paramId, store.trees]);

  const topic = useMemo(() => {
    if (!tree) return undefined;
    return store.topics.find((t) => t.id === tree.topicId);
  }, [tree, store.topics]);

  useEffect(() => {
    if (!paramId) return;
    if (tree) return;

    const existingTopic = store.topics.find((t) => t.id === paramId);
    if (existingTopic) {
      store.createTree(paramId, '');
    }
  }, [paramId, tree, store.topics]);

  useEffect(() => {
    if (tree) {
      setAuthorName(tree.authorName || '');
    }
  }, [tree?.id, tree?.authorName]);

  const currentActData = useMemo(() => {
    if (!tree) return undefined;
    return tree.acts.find((a) => a.type === currentAct);
  }, [tree, currentAct]);

  const currentActIndex = ACT_ORDER.indexOf(currentAct);
  const isActCompleted = useCallback(
    (actType: ActType) => {
      if (!tree) return false;
      const act = tree.acts.find((a) => a.type === actType);
      return act ? act.nodes.length > 0 : false;
    },
    [tree]
  );

  const allNodesWithGlobalIndex = useMemo(() => {
    if (!tree) return [] as { node: DialogueNode; globalIndex: number; actType: ActType }[];
    const result: { node: DialogueNode; globalIndex: number; actType: ActType }[] = [];
    let idx = 0;
    for (const actType of ACT_ORDER) {
      const act = tree.acts.find((a) => a.type === actType);
      if (act) {
        for (const node of act.nodes) {
          idx++;
          result.push({ node, globalIndex: idx, actType });
        }
      }
    }
    return result;
  }, [tree]);

  const nodeGlobalIndexMap = useMemo(() => {
    const map: Record<string, { globalIndex: number; node: DialogueNode; actType: ActType }> = {};
    for (const item of allNodesWithGlobalIndex) {
      map[item.node.id] = { globalIndex: item.globalIndex, node: item.node, actType: item.actType };
    }
    return map;
  }, [allNodesWithGlobalIndex]);

  const groupedNodeOptions = useMemo(() => {
    if (!tree) return {} as Record<ActType, { node: DialogueNode; globalIndex: number }[]>;
    const groups: Record<ActType, { node: DialogueNode; globalIndex: number }[]> = {
      opening: [],
      anomaly: [],
      collapse: [],
    };
    for (const item of allNodesWithGlobalIndex) {
      groups[item.actType].push({ node: item.node, globalIndex: item.globalIndex });
    }
    return groups;
  }, [allNodesWithGlobalIndex]);

  const hints = useMemo(() => {
    if (!tree) return [];
    return analyzeDialogueTree(tree);
  }, [tree]);

  const groupedHints = useMemo(() => {
    const groups: Record<string, HintItem[]> = {};
    for (const hint of hints) {
      if (!groups[hint.category]) groups[hint.category] = [];
      groups[hint.category].push(hint);
    }
    return groups;
  }, [hints]);

  const handleAuthorChange = useCallback(
    (val: string) => {
      setAuthorName(val);
      if (tree) {
        store.updateTree(tree.id, { authorName: val });
      }
    },
    [tree, store]
  );

  const handleAddNode = useCallback(() => {
    if (!tree || !currentActData) return;
    const node: DialogueNode = {
      id: generateId(),
      actId: currentActData.id,
      speaker: 'npc',
      content: '',
      emotionTag: '',
      choices: [],
    };
    store.addNode(tree.id, currentActData.id, node);
  }, [tree, currentActData, store]);

  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<DialogueNode>) => {
      if (!tree) return;
      store.updateNode(tree.id, nodeId, updates);
    },
    [tree, store]
  );

  const handleRemoveNode = useCallback(
    (nodeId: string) => {
      if (!tree || !currentActData) return;
      store.removeNode(tree.id, currentActData.id, nodeId);
    },
    [tree, currentActData, store]
  );

  const handleAddChoice = useCallback(
    (nodeId: string) => {
      if (!tree) return;
      const choice: PlayerChoice = {
        id: generateId(),
        text: '',
        emotionConsequence: '',
        nextNodeId: null,
      };
      store.addChoice(tree.id, nodeId, choice);
    },
    [tree, store]
  );

  const handleUpdateChoice = useCallback(
    (nodeId: string, choiceId: string, updates: Partial<PlayerChoice>) => {
      if (!tree) return;
      store.updateChoice(tree.id, nodeId, choiceId, updates);
    },
    [tree, store]
  );

  const handleRemoveChoice = useCallback(
    (nodeId: string, choiceId: string) => {
      if (!tree) return;
      store.removeChoice(tree.id, nodeId, choiceId);
    },
    [tree, store]
  );

  const handleShare = useCallback(async () => {
    if (!tree) return;
    const encoded = encodeTreeToUrl(tree as unknown as Record<string, unknown>);
    const url = `${window.location.origin}/play/${tree.id}?data=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [tree]);

  const handlePreview = useCallback(() => {
    if (!tree) return;
    navigate(`/play/${tree.id}`);
  }, [tree, navigate]);

  const handleImportFeedback = useCallback(() => {
    if (!tree) return;
    const decoded = decodeFeedbackCode(importCode.trim());
    if (!decoded) {
      showToast('error', '反馈码格式无效');
      return;
    }
    try {
      const playbackFeedback: PlaybackFeedback = {
        treeId: decoded.treeId,
        marks: decoded.marks,
        playedAt: decoded.playedAt,
        reviewerName: decoded.reviewerName,
      };
      store.importFeedback(playbackFeedback, decoded.treeSnapshot);
      showToast('success', '反馈导入成功');
      setShowImportModal(false);
      setImportCode('');
    } catch {
      showToast('error', '导入失败，请重试');
    }
  }, [tree, importCode, store, showToast]);

  if (!tree) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="horror-card text-center">
          <Ghost className="w-12 h-12 mx-auto mb-4 text-horror-muted" />
          <p className="text-horror-muted">正在加载对白树...</p>
        </div>
      </div>
    );
  }

  const actOptionLabels: Record<ActType, string> = {
    opening: '开场寒暄',
    anomaly: '异常暗示',
    collapse: '认知崩塌',
  };

  return (
    <div className="flex flex-col h-screen bg-horror-bg overflow-hidden">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-in-up">
          <div
            className={`horror-card px-4 py-2.5 flex items-center gap-2 text-sm ${
              toast.type === 'success' ? 'text-horror-success' : 'text-horror-danger'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {toast.message}
          </div>
        </div>
      )}

      <header className="flex items-center justify-between px-4 py-3 border-b border-horror-border bg-horror-surface shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="horror-btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            返回
          </button>
          <div className="hidden sm:block">
            <h1 className="text-horror-text font-medium text-sm">
              {topic?.title || '对白编辑器'}
            </h1>
            {topic && topic.constraints.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {topic.constraints.map((c, i) => (
                  <span key={i} className="horror-tag !text-[9px] !px-1.5 !py-0.5">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-[11px] text-horror-muted shrink-0">作者</span>
            <input
              type="text"
              value={authorName}
              onChange={(e) => handleAuthorChange(e.target.value)}
              placeholder="填写作者名"
              className="horror-input !py-1 !px-2 !text-xs w-28"
            />
          </div>
          <button
            onClick={() => setShowImportModal(true)}
            className="horror-btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">导入反馈</span>
          </button>
          <button
            onClick={handleShare}
            className="horror-btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            {copied ? (
              <Check className="w-4 h-4 text-horror-success" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{copied ? '已复制' : '分享'}</span>
          </button>
          <button
            onClick={handlePreview}
            className="horror-btn-primary flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">预览</span>
          </button>
        </div>
      </header>

      <div className="md:hidden px-4 py-2 border-b border-horror-border bg-horror-surface/50 flex items-center gap-1.5">
        <span className="text-[11px] text-horror-muted shrink-0">作者</span>
        <input
          type="text"
          value={authorName}
          onChange={(e) => handleAuthorChange(e.target.value)}
          placeholder="填写作者名"
          className="horror-input !py-1 !px-2 !text-xs flex-1"
        />
      </div>

      <div className="flex items-center px-4 py-3 border-b border-horror-border bg-horror-surface/50 shrink-0 overflow-x-auto">
        {ACT_ORDER.map((actType, index) => {
          const isActive = actType === currentAct;
          const completed = isActCompleted(actType);
          return (
            <React.Fragment key={actType}>
              {index > 0 && (
                <div className="flex-shrink-0 w-8 sm:w-12 h-px bg-horror-border mx-1" />
              )}
              <button
                onClick={() => setCurrentAct(actType)}
                className={`flex flex-col items-center gap-0.5 px-2 sm:px-4 py-1.5 rounded-lg transition-all duration-200 min-w-0 ${
                  isActive
                    ? 'bg-horror-rust/15 text-horror-rust-light'
                    : completed
                    ? 'text-horror-success hover:bg-horror-surface'
                    : 'text-horror-muted hover:bg-horror-surface hover:text-horror-text'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {completed && !isActive && (
                    <CheckCircle className="w-3.5 h-3.5 text-horror-success" />
                  )}
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap">
                    {ACT_LABELS[actType]}
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs opacity-60 truncate max-w-[80px] sm:max-w-none">
                  {ACT_DESCRIPTIONS[actType]}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden lg:flex flex-col w-64 border-r border-horror-border bg-horror-surface/30 overflow-y-auto shrink-0">
          <div className="p-4">
            <h2 className="text-horror-muted text-xs font-medium uppercase tracking-wider mb-3">
              对白结构
            </h2>
            <div className="space-y-2">
              {tree.acts.map((act) => (
                <button
                  key={act.id}
                  onClick={() => setCurrentAct(act.type)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                    act.type === currentAct
                      ? 'bg-horror-rust/15 border border-horror-rust/30'
                      : 'hover:bg-horror-surface border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-medium ${
                        act.type === currentAct
                          ? 'text-horror-rust-light'
                          : 'text-horror-text'
                      }`}
                    >
                      {ACT_LABELS[act.type]}
                    </span>
                    <span className="text-xs text-horror-muted">
                      {act.nodes.length} 条对白
                    </span>
                  </div>
                  <p className="text-[10px] text-horror-muted mt-1">
                    {ACT_DESCRIPTIONS[act.type]}
                  </p>
                  {act.nodes.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {act.nodes.map((node, i) => {
                        const globalIdx = nodeGlobalIndexMap[node.id]?.globalIndex || i + 1;
                        return (
                          <div
                            key={node.id}
                            className="text-[10px] text-horror-muted/70 bg-horror-bg/40 rounded px-2 py-1 truncate"
                          >
                            <span className="text-horror-rust/70 font-mono mr-1">
                              #{globalIdx}
                            </span>
                            {node.content.slice(0, 25) || '(空)'}
                            {node.content.length > 25 && '...'}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-auto p-4 border-t border-horror-border">
            <div className="flex items-center gap-2 text-horror-muted text-xs">
              <Brain className="w-4 h-4" />
              <span>总计 {tree.acts.reduce((s, a) => s + a.nodes.length, 0)} 条对白</span>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="w-5 h-5 text-horror-rust" />
                <h2 className="text-lg font-medium text-horror-text">
                  {ACT_LABELS[currentAct]}
                </h2>
              </div>
              <p className="text-sm text-horror-muted">{ACT_DESCRIPTIONS[currentAct]}</p>
            </div>

            <div className="space-y-4">
              {currentActData?.nodes.map((node, nodeIndex) => {
                const globalNodeIdx =
                  nodeGlobalIndexMap[node.id]?.globalIndex || nodeIndex + 1;
                return (
                  <div
                    key={node.id}
                    className="horror-card animate-slide-in-up"
                    style={{ animationDelay: `${nodeIndex * 50}ms` }}
                  >
                    <div
                      className={`${
                        node.speaker === 'npc'
                          ? 'border-l-2 border-l-horror-muted pl-4'
                          : 'pl-4'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleUpdateNode(node.id, {
                                speaker: node.speaker === 'npc' ? 'narrator' : 'npc',
                              })
                            }
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                              node.speaker === 'npc'
                                ? 'bg-horror-muted/20 text-horror-muted'
                                : 'bg-horror-panel text-horror-muted italic'
                            }`}
                          >
                            {node.speaker === 'npc' ? 'NPC' : '旁白'}
                          </button>
                          <span className="text-xs text-horror-muted/50 font-mono">
                            #{globalNodeIdx}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveNode(node.id)}
                          className="p-1.5 rounded-md text-horror-muted/50 hover:text-horror-danger hover:bg-horror-danger/10 transition-all duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <textarea
                        value={node.content}
                        onChange={(e) =>
                          handleUpdateNode(node.id, { content: e.target.value })
                        }
                        placeholder={
                          node.speaker === 'npc'
                            ? '输入NPC对白...'
                            : '输入旁白描写...'
                        }
                        rows={3}
                        className={`horror-input resize-y min-h-[80px] ${
                          node.speaker === 'narrator' ? 'italic' : ''
                        }`}
                      />

                      <div className="mt-3 flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-horror-warning/60" />
                        <input
                          type="text"
                          value={node.emotionTag}
                          onChange={(e) =>
                            handleUpdateNode(node.id, { emotionTag: e.target.value })
                          }
                          placeholder="情绪标签（可选）"
                          className="horror-input !py-1.5 !px-3 !text-xs flex-1 max-w-[200px]"
                        />
                      </div>

                      {node.speaker === 'npc' && (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-horror-muted font-medium">
                              玩家选项
                            </span>
                            <span className="text-[10px] text-horror-muted/50">
                              {node.choices.length}/3
                            </span>
                          </div>

                          {node.choices.map((choice, choiceIdx) => {
                            const hasBranchTarget = !!choice.nextNodeId;
                            const targetInfo = choice.nextNodeId
                              ? nodeGlobalIndexMap[choice.nextNodeId]
                              : null;
                            return (
                              <div
                                key={choice.id}
                                className={`pl-3 py-2 space-y-2 ${
                                  hasBranchTarget
                                    ? 'border-l-2 border-l-horror-rust/50'
                                    : 'border-l-2 border-l-horror-rust/40'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-horror-muted/50 font-mono shrink-0 w-4">
                                    {choiceIdx + 1}.
                                  </span>
                                  <input
                                    type="text"
                                    value={choice.text}
                                    onChange={(e) =>
                                      handleUpdateChoice(node.id, choice.id, {
                                        text: e.target.value,
                                      })
                                    }
                                    placeholder="选项文本"
                                    className="horror-input !py-1.5 !px-3 !text-xs flex-1"
                                  />
                                  <button
                                    onClick={() =>
                                      handleRemoveChoice(node.id, choice.id)
                                    }
                                    className="p-1 rounded text-horror-muted/50 hover:text-horror-danger transition-colors shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={choice.emotionConsequence}
                                  onChange={(e) =>
                                    handleUpdateChoice(node.id, choice.id, {
                                      emotionConsequence: e.target.value,
                                    })
                                  }
                                  placeholder="情绪后果"
                                  className="horror-input !py-1.5 !px-3 !text-xs w-full"
                                />
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <GitBranch
                                      className={`w-3.5 h-3.5 shrink-0 ${
                                        hasBranchTarget
                                          ? 'text-horror-rust-light'
                                          : 'text-horror-muted/50'
                                      }`}
                                    />
                                    <span className="text-[10px] text-horror-muted/50 shrink-0">
                                      跳转到
                                    </span>
                                    <select
                                      value={choice.nextNodeId || ''}
                                      onChange={(e) =>
                                        handleUpdateChoice(node.id, choice.id, {
                                          nextNodeId: e.target.value || null,
                                        })
                                      }
                                      className={`horror-input !py-1 !px-2 !text-xs flex-1 appearance-none cursor-pointer ${
                                        hasBranchTarget
                                          ? '!border-horror-rust/60 focus:!border-horror-rust-light'
                                          : ''
                                      }`}
                                    >
                                      <option value="">顺序推进 (默认)</option>
                                      {(
                                        Object.keys(groupedNodeOptions) as ActType[]
                                      ).map((actType) => {
                                        const optNodes = groupedNodeOptions[actType];
                                        if (optNodes.length === 0) return null;
                                        return (
                                          <optgroup
                                            key={actType}
                                            label={actOptionLabels[actType]}
                                          >
                                            {optNodes.map(({ node: optNode, globalIndex }) => (
                                              <option
                                                key={optNode.id}
                                                value={optNode.id}
                                              >
                                                {`[#${globalIndex}] ${
                                                  optNode.content.slice(0, 20) ||
                                                  '(空对白)'
                                                }${optNode.content.length > 20 ? '...' : ''}`}
                                              </option>
                                            ))}
                                          </optgroup>
                                        );
                                      })}
                                    </select>
                                  </div>
                                  {hasBranchTarget && targetInfo && targetInfo.node.content && (
                                    <div className="flex items-center gap-1 pl-5 text-[10px] text-horror-rust/80 font-mono truncate">
                                      <span>→</span>
                                      <span className="truncate">
                                        #{targetInfo.globalIndex}{' '}
                                        {targetInfo.node.content.slice(0, 30)}
                                        {targetInfo.node.content.length > 30 && '...'}
                                      </span>
                                    </div>
                                  )}
                                  {hasBranchTarget && !targetInfo && (
                                    <div className="flex items-center gap-1 pl-5 text-[10px] text-horror-danger/80 truncate">
                                      <XCircle className="w-3 h-3 shrink-0" />
                                      <span>目标节点已被删除</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {node.choices.length < 3 && (
                            <button
                              onClick={() => handleAddChoice(node.id)}
                              className="flex items-center gap-1.5 text-xs text-horror-rust/70 hover:text-horror-rust-light transition-colors py-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              添加选项
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleAddNode}
              className="mt-4 w-full horror-btn-ghost flex items-center justify-center gap-2 py-4"
            >
              <Plus className="w-4 h-4" />
              添加对白
            </button>
          </div>
        </main>

        <aside
          className={`hidden md:flex flex-col w-72 border-l border-horror-border bg-horror-surface/30 overflow-y-auto shrink-0`}
        >
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-horror-warning" />
              <h2 className="text-sm font-medium text-horror-text">智能提示</h2>
              <span className="ml-auto text-[10px] text-horror-muted">
                {hints.length} 条
              </span>
            </div>

            {hints.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-horror-muted/60">
                <CheckCircle className="w-8 h-8 mb-2" />
                <p className="text-sm">暂无提示</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedHints).map(([category, items]) => (
                  <div key={category}>
                    <span className="text-[10px] text-horror-muted/60 uppercase tracking-wider font-medium">
                      {CATEGORY_LABELS[category as HintItem['category']]}
                    </span>
                    <div className="mt-1.5 space-y-2">
                      {items.map((hint) => {
                        const iconClass =
                          hint.type === 'error'
                            ? 'text-horror-danger'
                            : hint.type === 'warning'
                            ? 'text-horror-warning'
                            : 'text-horror-success';
                        const borderClass =
                          hint.type === 'error'
                            ? 'border-horror-danger/30'
                            : hint.type === 'warning'
                            ? 'border-horror-warning/30'
                            : 'border-horror-success/30';
                        const textClass =
                          hint.type === 'error'
                            ? 'text-horror-danger'
                            : hint.type === 'warning'
                            ? 'text-horror-warning'
                            : 'text-horror-success';
                        const Icon =
                          hint.type === 'error'
                            ? XCircle
                            : hint.type === 'warning'
                            ? AlertTriangle
                            : CheckCircle;
                        return (
                          <div
                            key={hint.id}
                            className={`border ${borderClass} rounded-lg p-3 bg-horror-bg/50`}
                          >
                            <div className="flex items-start gap-2">
                              <Icon className={`w-4 h-4 ${iconClass} shrink-0 mt-0.5`} />
                              <p className={`text-xs ${textClass} leading-relaxed`}>
                                {hint.message}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <div className="md:hidden border-t border-horror-border bg-horror-surface">
        <button
          onClick={() => setShowHints(!showHints)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-horror-muted"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-horror-warning" />
            <span>智能提示</span>
            {hints.length > 0 && (
              <span className="bg-horror-rust/20 text-horror-rust-light text-[10px] px-1.5 py-0.5 rounded-full">
                {hints.length}
              </span>
            )}
          </div>
          {showHints ? (
            <ChevronRight className="w-4 h-4 rotate-90" />
          ) : (
            <ChevronRight className="w-4 h-4 -rotate-90" />
          )}
        </button>

        {showHints && (
          <div className="px-4 pb-4 max-h-[40vh] overflow-y-auto animate-slide-in-up">
            {hints.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-horror-muted/60">
                <CheckCircle className="w-6 h-6 mb-1" />
                <p className="text-xs">暂无提示</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(groupedHints).map(([category, items]) => (
                  <div key={category}>
                    <span className="text-[10px] text-horror-muted/60 uppercase tracking-wider font-medium">
                      {CATEGORY_LABELS[category as HintItem['category']]}
                    </span>
                    <div className="mt-1 space-y-1.5">
                      {items.map((hint) => {
                        const iconClass =
                          hint.type === 'error'
                            ? 'text-horror-danger'
                            : hint.type === 'warning'
                            ? 'text-horror-warning'
                            : 'text-horror-success';
                        const borderClass =
                          hint.type === 'error'
                            ? 'border-horror-danger/30'
                            : hint.type === 'warning'
                            ? 'border-horror-warning/30'
                            : 'border-horror-success/30';
                        const textClass =
                          hint.type === 'error'
                            ? 'text-horror-danger'
                            : hint.type === 'warning'
                            ? 'text-horror-warning'
                            : 'text-horror-success';
                        const Icon =
                          hint.type === 'error'
                            ? XCircle
                            : hint.type === 'warning'
                            ? AlertTriangle
                            : CheckCircle;
                        return (
                          <div
                            key={hint.id}
                            className={`border ${borderClass} rounded-lg p-2.5 bg-horror-bg/50`}
                          >
                            <div className="flex items-start gap-1.5">
                              <Icon className={`w-3.5 h-3.5 ${iconClass} shrink-0 mt-0.5`} />
                              <p className={`text-[11px] ${textClass} leading-relaxed`}>
                                {hint.message}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="horror-card w-full max-w-md animate-slide-in-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-horror-text font-medium flex items-center gap-2">
                <Download className="w-4 h-4 text-horror-rust" />
                导入反馈
              </h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportCode('');
                }}
                className="p-1 rounded text-horror-muted/50 hover:text-horror-text transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-horror-muted mb-3">
              粘贴以 FB- 开头的反馈码，导入测试者的恐惧标记数据
            </p>
            <textarea
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              placeholder="FB-xxxxxxxx..."
              rows={5}
              className="horror-input resize-none font-mono text-xs w-full"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportCode('');
                }}
                className="horror-btn-ghost px-4 py-2 text-sm"
              >
                取消
              </button>
              <button
                onClick={handleImportFeedback}
                disabled={!importCode.trim()}
                className="horror-btn-primary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
