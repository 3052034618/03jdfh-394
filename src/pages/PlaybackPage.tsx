import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@/store';
import type { DialogueTree, DialogueNode, PlaybackMode, FearMark } from '@/types';
import { ACT_LABELS } from '@/types';
import { generateId, decodeTreeFromUrl } from '@/utils';
import { MessageSquare, Subtitles, Skull, ChevronRight, RotateCcw, BarChart3, X, Flame, Eye } from 'lucide-react';

interface DisplayItem {
  type: 'node' | 'player-choice';
  nodeId?: string;
  speaker?: 'npc' | 'narrator';
  content: string;
  actId?: string;
  emotionTag?: string;
}

export default function PlaybackPage() {
  const { id: treeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const store = useStore();

  const [tree, setTree] = useState<DialogueTree | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<PlaybackMode>('chat');
  const [showStats, setShowStats] = useState(false);

  const [flatNodes, setFlatNodes] = useState<DialogueNode[]>([]);
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [typedChars, setTypedChars] = useState(0);
  const [waitingForChoice, setWaitingForChoice] = useState(false);
  const [fearMarks, setFearMarks] = useState<FearMark[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [subtitleFading, setSubtitleFading] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const dataParam = searchParams.get('data');
    if (dataParam) {
      const decoded = decodeTreeFromUrl(dataParam);
      if (decoded && decoded.id && decoded.acts) {
        setTree(decoded as unknown as DialogueTree);
        return;
      }
    }
    if (treeId) {
      const found = store.getTreeById(treeId);
      if (found) {
        setTree(found);
        return;
      }
    }
    setNotFound(true);
  }, [treeId, searchParams]);

  useEffect(() => {
    if (!tree) return;
    const nodes: DialogueNode[] = [];
    const sortedActs = [...tree.acts].sort((a, b) => a.order - b.order);
    for (const act of sortedActs) {
      for (const node of act.nodes) {
        nodes.push(node);
      }
    }
    setFlatNodes(nodes);
  }, [tree]);

  useEffect(() => {
    if (flatNodes.length === 0) {
      setIsComplete(true);
      return;
    }
    startNode(0);
  }, [flatNodes]);

  useEffect(() => {
    if (displayItems.length === 0) return;
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, [displayItems]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  const currentNode = currentIndex < flatNodes.length ? flatNodes[currentIndex] : null;

  useEffect(() => {
    if (!currentNode || !isTyping) return;

    const totalChars = currentNode.content.length;
    if (typedChars >= totalChars) {
      setIsTyping(false);
      if (currentNode.choices.length > 0) {
        setWaitingForChoice(true);
      } else {
        advanceAfterNode(currentNode);
      }
      return;
    }

    const delay = mode === 'chat' ? 20 : 30;
    typingTimerRef.current = setTimeout(() => {
      setTypedChars((prev) => prev + 1);
    }, delay);

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, [currentNode, isTyping, typedChars, mode]);

  const startNode = useCallback((index: number) => {
    if (index >= flatNodes.length) {
      setIsComplete(true);
      return;
    }
    setCurrentIndex(index);
    setTypedChars(0);
    setIsTyping(true);
    setWaitingForChoice(false);
  }, [flatNodes]);

  const advanceAfterNode = useCallback((node: DialogueNode) => {
    const item: DisplayItem = {
      type: 'node',
      nodeId: node.id,
      speaker: node.speaker,
      content: node.content,
      actId: node.actId,
      emotionTag: node.emotionTag,
    };
    setDisplayItems((prev) => [...prev, item]);
    setTimeout(() => {
      startNode(currentIndex + 1);
    }, 300);
  }, [currentIndex, startNode]);

  const handleChoice = useCallback((choiceText: string) => {
    if (!currentNode) return;
    const nodeItem: DisplayItem = {
      type: 'node',
      nodeId: currentNode.id,
      speaker: currentNode.speaker,
      content: currentNode.content,
      actId: currentNode.actId,
      emotionTag: currentNode.emotionTag,
    };
    const choiceItem: DisplayItem = {
      type: 'player-choice',
      content: choiceText,
    };
    setDisplayItems((prev) => [...prev, nodeItem, choiceItem]);
    setWaitingForChoice(false);

    if (mode === 'subtitle') {
      setSubtitleFading(true);
      setTimeout(() => {
        setSubtitleFading(false);
        startNode(currentIndex + 1);
      }, 400);
    } else {
      setTimeout(() => {
        startNode(currentIndex + 1);
      }, 300);
    }
  }, [currentNode, mode, startNode]);

  const handleDoubleClick = useCallback((nodeId: string) => {
    setFearMarks((prev) => {
      const existing = prev.find((m) => m.nodeId === nodeId);
      if (existing) return prev;
      return [...prev, { id: generateId(), nodeId, timestamp: Date.now() }];
    });
  }, []);

  const handleRestart = useCallback(() => {
    setDisplayItems([]);
    setCurrentIndex(0);
    setTypedChars(0);
    setIsTyping(false);
    setWaitingForChoice(false);
    setFearMarks([]);
    setIsComplete(false);
    setFeedbackSaved(false);
    setSubtitleFading(false);
    if (flatNodes.length > 0) {
      startNode(0);
    }
  }, [flatNodes, startNode]);

  const handleSaveFeedback = useCallback(() => {
    if (!tree || feedbackSaved) return;
    store.addFeedback({
      treeId: tree.id,
      marks: fearMarks,
      playedAt: Date.now(),
    });
    setFeedbackSaved(true);
  }, [tree, fearMarks, feedbackSaved, store]);

  const topicTitle = tree
    ? store.topics.find((t) => t.id === tree.topicId)?.title || '未知场景'
    : '';

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-horror-bg">
        <div className="text-center">
          <Skull className="mx-auto mb-4 h-16 w-16 text-horror-rust/50" />
          <p className="text-xl text-horror-muted">对白树不存在</p>
          <button
            className="horror-btn-primary mt-6"
            onClick={() => navigate('/')}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (!tree) return null;

  return (
    <div className="min-h-screen bg-horror-bg flex flex-col">
      <TopBar
        mode={mode}
        onModeChange={setMode}
        showStats={showStats}
        onToggleStats={() => setShowStats((v) => !v)}
        onRestart={handleRestart}
      />

      <div className="flex-1 relative overflow-hidden">
        {mode === 'chat' ? (
          <ChatView
            displayItems={displayItems}
            currentNode={currentNode}
            isTyping={isTyping}
            typedChars={typedChars}
            waitingForChoice={waitingForChoice}
            fearMarks={fearMarks}
            topicTitle={topicTitle}
            onChoice={handleChoice}
            onDoubleClick={handleDoubleClick}
            chatEndRef={chatEndRef}
          />
        ) : (
          <SubtitleView
            currentNode={currentNode}
            isTyping={isTyping}
            typedChars={typedChars}
            waitingForChoice={waitingForChoice}
            fearMarks={fearMarks}
            fading={subtitleFading}
            onChoice={handleChoice}
            onDoubleClick={handleDoubleClick}
          />
        )}

        {isComplete && (
          <EndScreen
            fearMarkCount={fearMarks.length}
            feedbackSaved={feedbackSaved}
            onSave={handleSaveFeedback}
            onRestart={handleRestart}
            onBack={() => navigate('/')}
            hasContent={flatNodes.length > 0}
          />
        )}

        {showStats && (
          <StatsPanel
            treeId={tree.id}
            onClose={() => setShowStats(false)}
          />
        )}
      </div>
    </div>
  );
}

function TopBar({
  mode,
  onModeChange,
  showStats,
  onToggleStats,
  onRestart,
}: {
  mode: PlaybackMode;
  onModeChange: (m: PlaybackMode) => void;
  showStats: boolean;
  onToggleStats: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-horror-border bg-horror-surface/80 px-4 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-1">
        <button
          className={`horror-btn text-xs ${mode === 'chat' ? 'border-horror-rust/50 text-horror-rust-light' : 'text-horror-muted'}`}
          onClick={() => onModeChange('chat')}
        >
          <MessageSquare className="mr-1 h-3.5 w-3.5" />
          手机聊天
        </button>
        <button
          className={`horror-btn text-xs ${mode === 'subtitle' ? 'border-horror-rust/50 text-horror-rust-light' : 'text-horror-muted'}`}
          onClick={() => onModeChange('subtitle')}
        >
          <Subtitles className="mr-1 h-3.5 w-3.5" />
          游戏字幕
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button
          className={`horror-btn text-xs ${showStats ? 'border-horror-rust/50 text-horror-rust-light' : 'text-horror-muted'}`}
          onClick={onToggleStats}
        >
          <BarChart3 className="mr-1 h-3.5 w-3.5" />
          反馈统计
        </button>
        <button
          className="horror-btn text-xs text-horror-muted"
          onClick={onRestart}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          重新开始
        </button>
      </div>
    </div>
  );
}

function ChatView({
  displayItems,
  currentNode,
  isTyping,
  typedChars,
  waitingForChoice,
  fearMarks,
  topicTitle,
  onChoice,
  onDoubleClick,
  chatEndRef,
}: {
  displayItems: DisplayItem[];
  currentNode: DialogueNode | null;
  isTyping: boolean;
  typedChars: number;
  waitingForChoice: boolean;
  fearMarks: FearMark[];
  topicTitle: string;
  onChoice: (text: string) => void;
  onDoubleClick: (nodeId: string) => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const markedNodeIds = new Set(fearMarks.map((m) => m.nodeId));

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="flex h-full max-h-[calc(100vh-4rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-horror-border bg-horror-bg">
        <div className="flex items-center gap-2 border-b border-horror-border bg-horror-surface px-4 py-3">
          <Skull className="h-4 w-4 text-horror-rust" />
          <span className="text-sm font-medium text-horror-text">{topicTitle}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
          {displayItems.map((item, i) => {
            if (item.type === 'player-choice') {
              return (
                <div
                  key={`p-${i}`}
                  className="flex justify-end animate-slide-in-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-horror-rust/10 px-4 py-2.5 text-sm text-horror-text">
                    {item.content}
                  </div>
                </div>
              );
            }

            const isMarked = item.nodeId ? markedNodeIds.has(item.nodeId) : false;

            if (item.speaker === 'narrator') {
              return (
                <div
                  key={`n-${i}`}
                  className="text-center animate-slide-in-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                  onDoubleClick={() => item.nodeId && onDoubleClick(item.nodeId)}
                >
                  <p className="mx-auto max-w-[90%] text-xs italic text-horror-muted/70">
                    {item.content}
                  </p>
                  {isMarked && (
                    <Skull className="mx-auto mt-1 h-3 w-3 text-horror-rust animate-pulse-rust" />
                  )}
                </div>
              );
            }

            return (
              <div
                key={`n-${i}`}
                className="flex justify-start animate-slide-in-up"
                style={{ animationDelay: `${i * 30}ms` }}
                onDoubleClick={() => item.nodeId && onDoubleClick(item.nodeId)}
              >
                <div
                  className={`max-w-[80%] rounded-2xl rounded-tl-sm bg-horror-panel px-4 py-2.5 text-sm text-horror-text ${isMarked ? 'animate-pulse-rust' : ''}`}
                >
                  {item.content}
                  {isMarked && (
                    <Skull className="ml-1 inline h-3 w-3 text-horror-rust" />
                  )}
                </div>
              </div>
            );
          })}

          {isTyping && currentNode && (
            <CurrentChatBubble
              node={currentNode}
              typedChars={typedChars}
              isMarked={markedNodeIds.has(currentNode.id)}
              onDoubleClick={onDoubleClick}
            />
          )}

          <div ref={chatEndRef} />
        </div>

        {waitingForChoice && currentNode && (
          <div className="border-t border-horror-border bg-horror-surface/50 px-3 py-3">
            <div className="flex flex-wrap gap-2">
              {currentNode.choices.map((choice) => (
                <button
                  key={choice.id}
                  className="rounded-full border-2 border-horror-rust/30 px-4 py-2 text-sm text-horror-text transition-all hover:border-horror-rust/60 hover:bg-horror-rust/10 active:scale-95"
                  onClick={() => onChoice(choice.text)}
                >
                  {choice.text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CurrentChatBubble({
  node,
  typedChars,
  isMarked,
  onDoubleClick,
}: {
  node: DialogueNode;
  typedChars: number;
  isMarked: boolean;
  onDoubleClick: (nodeId: string) => void;
}) {
  const displayText = node.content.slice(0, typedChars);
  const isComplete = typedChars >= node.content.length;

  if (node.speaker === 'narrator') {
    return (
      <div
        className="text-center animate-slide-in-up"
        onDoubleClick={() => onDoubleClick(node.id)}
      >
        <p className="mx-auto max-w-[90%] text-xs italic text-horror-muted/70">
          {displayText}
          {!isComplete && <span className="animate-typewriter">|</span>}
        </p>
        {isMarked && <Skull className="mx-auto mt-1 h-3 w-3 text-horror-rust animate-pulse-rust" />}
      </div>
    );
  }

  return (
    <div
      className="flex justify-start animate-slide-in-up"
      onDoubleClick={() => onDoubleClick(node.id)}
    >
      <div
        className={`max-w-[80%] rounded-2xl rounded-tl-sm bg-horror-panel px-4 py-2.5 text-sm text-horror-text ${isMarked ? 'animate-pulse-rust' : ''}`}
      >
        {displayText}
        {!isComplete && <span className="animate-typewriter">|</span>}
        {isMarked && <Skull className="ml-1 inline h-3 w-3 text-horror-rust" />}
      </div>
    </div>
  );
}

function SubtitleView({
  currentNode,
  isTyping,
  typedChars,
  waitingForChoice,
  fearMarks,
  fading,
  onChoice,
  onDoubleClick,
}: {
  currentNode: DialogueNode | null;
  isTyping: boolean;
  typedChars: number;
  waitingForChoice: boolean;
  fearMarks: FearMark[];
  fading: boolean;
  onChoice: (text: string) => void;
  onDoubleClick: (nodeId: string) => void;
}) {
  const markedNodeIds = new Set(fearMarks.map((m) => m.nodeId));
  if (!currentNode) return null;

  const displayText = currentNode.content.slice(0, typedChars);
  const isComplete = typedChars >= currentNode.content.length;
  const isMarked = markedNodeIds.has(currentNode.id);

  return (
    <div
      className={`flex h-full flex-col items-center justify-center px-8 transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}
      onDoubleClick={() => onDoubleClick(currentNode.id)}
    >
      <div className="max-w-2xl text-center">
        {currentNode.speaker === 'narrator' ? (
          <p className="mb-2 text-xs uppercase tracking-widest text-horror-muted/50">
            旁白
          </p>
        ) : (
          <p className="mb-2 text-xs uppercase tracking-widest text-horror-rust/60">
            NPC
          </p>
        )}

        <p className="font-mono text-xl leading-relaxed text-horror-text md:text-2xl">
          {displayText}
          {!isComplete && <span className="animate-typewriter text-horror-rust">|</span>}
        </p>

        {isMarked && (
          <Skull className="mx-auto mt-4 h-5 w-5 text-horror-rust animate-pulse-rust" />
        )}
      </div>

      {waitingForChoice && (
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {currentNode.choices.map((choice) => (
            <button
              key={choice.id}
              className="rounded-full border-2 border-horror-rust/30 px-6 py-2.5 font-mono text-sm text-horror-text transition-all hover:border-horror-rust/60 hover:bg-horror-rust/10 active:scale-95"
              onClick={() => onChoice(choice.text)}
            >
              {choice.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EndScreen({
  fearMarkCount,
  feedbackSaved,
  onSave,
  onRestart,
  onBack,
  hasContent = true,
}: {
  fearMarkCount: number;
  feedbackSaved: boolean;
  onSave: () => void;
  onRestart: () => void;
  onBack: () => void;
  hasContent?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-horror-bg/90 backdrop-blur-sm animate-fade-in">
      <div className="text-center">
        <Skull className="mx-auto mb-6 h-16 w-16 text-horror-rust animate-glow" />
        {hasContent ? (
          <>
            <h2 className="mb-4 font-creep text-4xl text-horror-rust">体验结束</h2>
            <p className="mb-8 flex items-center justify-center gap-2 text-horror-muted">
              <Eye className="h-4 w-4" />
              你标记了 <span className="font-medium text-horror-rust-light">{fearMarkCount}</span> 处恐惧点
            </p>
          </>
        ) : (
          <>
            <h2 className="mb-4 font-creep text-4xl text-horror-rust">空空如也</h2>
            <p className="mb-8 text-horror-muted">这个对白树还没有内容</p>
          </>
        )}
        <div className="flex flex-col items-center gap-3">
          {hasContent && (
            <button
              className="horror-btn-primary w-48"
              onClick={onSave}
              disabled={feedbackSaved}
            >
              {feedbackSaved ? '反馈已保存' : '保存反馈'}
            </button>
          )}
          <button
            className="horror-btn-ghost w-48"
            onClick={onBack}
          >
            返回题目
          </button>
        </div>
      </div>
    </div>
  );
}

function StatsPanel({
  treeId,
  onClose,
}: {
  treeId: string;
  onClose: () => void;
}) {
  const feedbacks = useStore((s) => s.getFeedbacksByTreeId(treeId));
  const trees = useStore((s) => s.trees);
  const tree = trees.find((t) => t.id === treeId);

  const nodeMarkCounts: Record<string, { text: string; count: number }> = {};
  for (const fb of feedbacks) {
    for (const mark of fb.marks) {
      if (!nodeMarkCounts[mark.nodeId]) {
        nodeMarkCounts[mark.nodeId] = { text: '', count: 0 };
      }
      nodeMarkCounts[mark.nodeId].count++;
    }
  }

  if (tree) {
    for (const act of tree.acts) {
      for (const node of act.nodes) {
        if (!nodeMarkCounts[node.id]) {
          nodeMarkCounts[node.id] = { text: '', count: 0 };
        }
        nodeMarkCounts[node.id].text = node.content;
      }
    }
  }

  const entries = Object.entries(nodeMarkCounts).filter(([, v]) => v.text);
  const maxCount = Math.max(1, ...entries.map(([, v]) => v.count));

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-80 flex-col border-l border-horror-border bg-horror-surface shadow-2xl animate-slide-in-right">
      <div className="flex items-center justify-between border-b border-horror-border px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-medium text-horror-text">
          <BarChart3 className="h-4 w-4 text-horror-rust" />
          反馈统计
        </h3>
        <button className="text-horror-muted hover:text-horror-text" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="mb-3 text-xs text-horror-muted">
          共 {feedbacks.length} 份反馈
        </p>

        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-horror-muted/50">
            暂无反馈数据
          </p>
        ) : (
          <div className="space-y-3">
            {entries.map(([nodeId, { text, count }]) => {
              const ratio = count / maxCount;
              const hue = 220 - ratio * 190;
              const barColor = `hsl(${hue}, 70%, ${45 + ratio * 10}%)`;
              return (
                <div key={nodeId}>
                  <p className="mb-1 truncate text-xs text-horror-muted">
                    {text}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-horror-border">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(ratio * 100, count > 0 ? 8 : 0)}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                    <span className="min-w-[1.5rem] text-right text-xs text-horror-muted">
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
