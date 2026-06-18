import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@/store';
import type { DialogueTree, DialogueNode, PlaybackMode, FearMark, FeedbackCode, PlaybackFeedback } from '@/types';
import { ACT_LABELS } from '@/types';
import { generateId, decodeTreeFromUrl, encodeFeedbackCode, buildFeedbackCode, decodeFeedbackCode } from '@/utils';
import { MessageSquare, Subtitles, Skull, ChevronRight, RotateCcw, BarChart3, X, Flame, Eye, Copy, Check, User, Share2 } from 'lucide-react';

interface DisplayItem {
  type: 'node' | 'player-choice';
  nodeId?: string;
  speaker?: 'npc' | 'narrator';
  content: string;
  actId?: string;
  emotionTag?: string;
  choiceId?: string;
}

export default function PlaybackPage() {
  const { id: treeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const store = useStore();

  const [tree, setTree] = useState<DialogueTree | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<PlaybackMode>('chat');
  const [showStats, setShowStats] = useState(false);
  const [showFeedbackBanner, setShowFeedbackBanner] = useState<string | null>(null);

  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [visitedNodeIds, setVisitedNodeIds] = useState<string[]>([]);
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typedChars, setTypedChars] = useState(0);
  const [waitingForChoice, setWaitingForChoice] = useState(false);
  const [fearMarks, setFearMarks] = useState<FearMark[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [subtitleFading, setSubtitleFading] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [reviewerName, setReviewerName] = useState('');
  const [generatedFeedbackCode, setGeneratedFeedbackCode] = useState<string>('');
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [feedbackLink, setFeedbackLink] = useState('');
  const [isSharedTree, setIsSharedTree] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentNodeAddedRef = useRef(false);

  const flatOrderedNodes = useMemo<DialogueNode[]>(() => {
    if (!tree) return [];
    const sortedActs = [...tree.acts].sort((a, b) => a.order - b.order);
    const nodes: DialogueNode[] = [];
    for (const act of sortedActs) {
      for (const node of act.nodes) {
        nodes.push(node);
      }
    }
    return nodes;
  }, [tree]);

  const nodeMap = useMemo<Record<string, DialogueNode>>(() => {
    const map: Record<string, DialogueNode> = {};
    for (const node of flatOrderedNodes) {
      map[node.id] = node;
    }
    return map;
  }, [flatOrderedNodes]);

  const nodeIndexMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    flatOrderedNodes.forEach((node, idx) => {
      map[node.id] = idx + 1;
    });
    return map;
  }, [flatOrderedNodes]);

  const currentNode = useMemo<DialogueNode | null>(() => {
    if (!currentNodeId || !nodeMap[currentNodeId]) return null;
    return nodeMap[currentNodeId];
  }, [currentNodeId, nodeMap]);

  const getStartingNodeId = useCallback((t: DialogueTree): string | null => {
    const sortedActs = [...t.acts].sort((a, b) => a.order - b.order);
    for (const act of sortedActs) {
      if (act.nodes.length > 0) {
        return act.nodes[0].id;
      }
    }
    return null;
  }, []);

  const getNextNodeIdByOrder = useCallback((t: DialogueTree, curNodeId: string): string | null => {
    const sortedActs = [...t.acts].sort((a, b) => a.order - b.order);
    const allNodes: DialogueNode[] = [];
    for (const act of sortedActs) {
      for (const node of act.nodes) {
        allNodes.push(node);
      }
    }
    const idx = allNodes.findIndex((n) => n.id === curNodeId);
    if (idx === -1 || idx >= allNodes.length - 1) return null;
    return allNodes[idx + 1].id;
  }, []);

  useEffect(() => {
    const dataParam = searchParams.get('data');
    const feedbackParam = searchParams.get('feedback');

    if (dataParam) {
      const decoded = decodeTreeFromUrl(dataParam);
      if (decoded && decoded.id && decoded.acts) {
        setTree(decoded as unknown as DialogueTree);
        setIsSharedTree(true);
      }
    } else if (treeId) {
      const found = store.getTreeById(treeId);
      if (found) {
        setTree(found);
      }
    }

    if (!dataParam && treeId) {
      const found = store.getTreeById(treeId);
      if (!found && !dataParam) {
        setNotFound(true);
      }
    }

    if (feedbackParam) {
      const decodedFb = decodeFeedbackCode(feedbackParam);
      if (decodedFb) {
        const fbToAdd: PlaybackFeedback = {
          treeId: decodedFb.treeId,
          marks: decodedFb.marks,
          playedAt: decodedFb.playedAt,
          reviewerName: decodedFb.reviewerName,
        };
        store.addFeedback(fbToAdd);
        const nameText = decodedFb.reviewerName ? `（来自 ${decodedFb.reviewerName}）` : '';
        setShowFeedbackBanner(`已自动加载来自分享链接的反馈${nameText}`);
        if (!dataParam && !treeId) {
        } else if (decodedFb.treeSnapshot) {
          if (!dataParam) {
            setTree(decodedFb.treeSnapshot);
            setIsSharedTree(true);
          }
        }
      }
    }

    if (!dataParam && !treeId && !feedbackParam) {
      setNotFound(true);
    }
  }, [treeId, searchParams, store]);

  useEffect(() => {
    if (!tree) return;
    const startId = getStartingNodeId(tree);
    if (!startId) {
      setIsComplete(true);
      return;
    }
    setTimeout(() => startNode(startId), 50);
  }, [tree, getStartingNodeId]);

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

  const startNode = useCallback((nodeId: string) => {
    if (!nodeMap[nodeId]) {
      setIsComplete(true);
      return;
    }
    setCurrentNodeId(nodeId);
    setVisitedNodeIds((prev) => {
      if (prev.includes(nodeId)) return prev;
      return [...prev, nodeId];
    });
    setTypedChars(0);
    setIsTyping(true);
    setWaitingForChoice(false);
    currentNodeAddedRef.current = false;
  }, [nodeMap]);

  const addCurrentNodeToDisplay = useCallback(() => {
    if (!currentNode || currentNodeAddedRef.current) return;
    currentNodeAddedRef.current = true;
    const item: DisplayItem = {
      type: 'node',
      nodeId: currentNode.id,
      speaker: currentNode.speaker,
      content: currentNode.content,
      actId: currentNode.actId,
      emotionTag: currentNode.emotionTag,
    };
    setDisplayItems((prev) => [...prev, item]);
  }, [currentNode]);

  const advanceAfterNode = useCallback((node: DialogueNode) => {
    addCurrentNodeToDisplay();
    setTimeout(() => {
      if (!tree) return;
      const fallback = getNextNodeIdByOrder(tree, node.id);
      if (fallback && nodeMap[fallback]) {
        startNode(fallback);
      } else {
        setIsComplete(true);
      }
    }, 300);
  }, [tree, getNextNodeIdByOrder, nodeMap, startNode, addCurrentNodeToDisplay]);

  const handleChoice = useCallback((choiceId: string, choiceText: string, nextNodeId: string | null) => {
    if (!currentNode || !tree) return;
    addCurrentNodeToDisplay();

    const choiceItem: DisplayItem = {
      type: 'player-choice',
      content: choiceText,
      choiceId,
    };
    setDisplayItems((prev) => [...prev, choiceItem]);
    setWaitingForChoice(false);

    let targetNodeId: string | null = null;
    if (nextNodeId && nodeMap[nextNodeId]) {
      targetNodeId = nextNodeId;
    } else {
      const allChoicesHaveNext = currentNode.choices.every((c) => c.nextNodeId && nodeMap[c.nextNodeId]);
      if (!allChoicesHaveNext) {
        targetNodeId = getNextNodeIdByOrder(tree, currentNode.id);
      } else {
        setIsComplete(true);
        return;
      }
    }

    const goToNode = () => {
      if (targetNodeId && nodeMap[targetNodeId]) {
        startNode(targetNodeId);
      } else {
        setIsComplete(true);
      }
    };

    if (mode === 'subtitle') {
      setSubtitleFading(true);
      setTimeout(() => {
        setSubtitleFading(false);
        goToNode();
      }, 400);
    } else {
      setTimeout(goToNode, 300);
    }
  }, [currentNode, tree, nodeMap, mode, startNode, getNextNodeIdByOrder, addCurrentNodeToDisplay]);

  const handleDoubleClick = useCallback((nodeId: string) => {
    setFearMarks((prev) => {
      const existing = prev.find((m) => m.nodeId === nodeId);
      if (existing) return prev;
      return [...prev, { id: generateId(), nodeId, timestamp: Date.now() }];
    });
  }, []);

  const handleRestart = useCallback(() => {
    setDisplayItems([]);
    setCurrentNodeId(null);
    setVisitedNodeIds([]);
    setTypedChars(0);
    setIsTyping(false);
    setWaitingForChoice(false);
    setFearMarks([]);
    setIsComplete(false);
    setFeedbackSaved(false);
    setSubtitleFading(false);
    setGeneratedFeedbackCode('');
    setFeedbackLink('');
    setCopiedFeedback(false);
    setCopiedLink(false);
    setReviewerName('');
    currentNodeAddedRef.current = false;
    if (tree) {
      const startId = getStartingNodeId(tree);
      if (startId) {
        setTimeout(() => startNode(startId), 50);
      }
    }
  }, [tree, getStartingNodeId, startNode]);

  const handleSaveFeedback = useCallback(() => {
    if (!tree || feedbackSaved) return;

    const fb: PlaybackFeedback = {
      treeId: tree.id,
      marks: fearMarks,
      playedAt: Date.now(),
      reviewerName: reviewerName.trim() || undefined,
    };
    store.addFeedback(fb);

    const feedbackCodeObj = buildFeedbackCode(tree, fb, reviewerName.trim());
    const code = encodeFeedbackCode(feedbackCodeObj);
    setGeneratedFeedbackCode(code);

    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const link = `${baseUrl}?feedback=${encodeURIComponent(code)}`;
    setFeedbackLink(link);

    setFeedbackSaved(true);
  }, [tree, fearMarks, feedbackSaved, reviewerName, store]);

  const handleCopyFeedback = useCallback(async () => {
    if (!generatedFeedbackCode) return;
    try {
      await navigator.clipboard.writeText(generatedFeedbackCode);
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = generatedFeedbackCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    }
  }, [generatedFeedbackCode]);

  const handleCopyLink = useCallback(async () => {
    if (!feedbackLink) return;
    try {
      await navigator.clipboard.writeText(feedbackLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = feedbackLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }, [feedbackLink]);

  const topicTitle = useMemo(() => {
    if (!tree) return '';
    const topic = store.topics.find((t) => t.id === tree.topicId);
    if (topic) return topic.title;
    if (isSharedTree) return '共享对白';
    return '未知场景';
  }, [tree, store.topics, isSharedTree]);

  const hasContent = flatOrderedNodes.length > 0;

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
      {showFeedbackBanner && (
        <div className="flex items-center justify-between border-b border-horror-rust/30 bg-horror-rust/10 px-4 py-2 text-sm">
          <span className="flex items-center gap-2 text-horror-rust-light">
            <Flame className="h-4 w-4" />
            {showFeedbackBanner}
          </span>
          <button
            className="text-horror-muted hover:text-horror-text"
            onClick={() => setShowFeedbackBanner(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
            nodeIndexMap={nodeIndexMap}
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
            nodeIndexMap={nodeIndexMap}
          />
        )}

        {isComplete && (
          <EndScreen
            fearMarkCount={fearMarks.length}
            feedbackSaved={feedbackSaved}
            generatedFeedbackCode={generatedFeedbackCode}
            feedbackLink={feedbackLink}
            reviewerName={reviewerName}
            onReviewerNameChange={setReviewerName}
            onSave={handleSaveFeedback}
            onRestart={handleRestart}
            onBack={() => navigate('/')}
            hasContent={hasContent}
            onCopyFeedback={handleCopyFeedback}
            onCopyLink={handleCopyLink}
            copiedFeedback={copiedFeedback}
            copiedLink={copiedLink}
          />
        )}

        {showStats && (
          <StatsPanel
            treeId={tree.id}
            treeSnapshot={isSharedTree ? tree : null}
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
  nodeIndexMap,
}: {
  displayItems: DisplayItem[];
  currentNode: DialogueNode | null;
  isTyping: boolean;
  typedChars: number;
  waitingForChoice: boolean;
  fearMarks: FearMark[];
  topicTitle: string;
  onChoice: (choiceId: string, text: string, nextNodeId: string | null) => void;
  onDoubleClick: (nodeId: string) => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  nodeIndexMap: Record<string, number>;
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
            const nodeNum = item.nodeId ? nodeIndexMap[item.nodeId] : null;

            if (item.speaker === 'narrator') {
              return (
                <div
                  key={`n-${i}`}
                  className="text-center animate-slide-in-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                  onDoubleClick={() => item.nodeId && onDoubleClick(item.nodeId)}
                >
                  {nodeNum && (
                    <span className="mb-1 inline-block text-[10px] font-mono text-horror-muted/40">
                      #{nodeNum}
                    </span>
                  )}
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
                  {nodeNum && (
                    <span className="mr-1.5 text-[10px] font-mono text-horror-muted/40">
                      #{nodeNum}
                    </span>
                  )}
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
              nodeNum={nodeIndexMap[currentNode.id]}
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
                  onClick={() => onChoice(choice.id, choice.text, choice.nextNodeId)}
                >
                  {choice.text}
                  <ChevronRight className="ml-1 inline h-3 w-3 opacity-50" />
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
  nodeNum,
}: {
  node: DialogueNode;
  typedChars: number;
  isMarked: boolean;
  onDoubleClick: (nodeId: string) => void;
  nodeNum?: number;
}) {
  const displayText = node.content.slice(0, typedChars);
  const isComplete = typedChars >= node.content.length;

  if (node.speaker === 'narrator') {
    return (
      <div
        className="text-center animate-slide-in-up"
        onDoubleClick={() => onDoubleClick(node.id)}
      >
        {nodeNum && (
          <span className="mb-1 inline-block text-[10px] font-mono text-horror-muted/40">
            #{nodeNum}
          </span>
        )}
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
        {nodeNum && (
          <span className="mr-1.5 text-[10px] font-mono text-horror-muted/40">
            #{nodeNum}
          </span>
        )}
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
  nodeIndexMap,
}: {
  currentNode: DialogueNode | null;
  isTyping: boolean;
  typedChars: number;
  waitingForChoice: boolean;
  fearMarks: FearMark[];
  fading: boolean;
  onChoice: (choiceId: string, text: string, nextNodeId: string | null) => void;
  onDoubleClick: (nodeId: string) => void;
  nodeIndexMap: Record<string, number>;
}) {
  const markedNodeIds = new Set(fearMarks.map((m) => m.nodeId));
  if (!currentNode) return null;

  const displayText = currentNode.content.slice(0, typedChars);
  const isComplete = typedChars >= currentNode.content.length;
  const isMarked = markedNodeIds.has(currentNode.id);
  const nodeNum = nodeIndexMap[currentNode.id];

  return (
    <div
      className={`flex h-full flex-col items-center justify-center px-8 transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}
      onDoubleClick={() => onDoubleClick(currentNode.id)}
    >
      <div className="max-w-2xl text-center">
        {nodeNum && (
          <p className="mb-1 font-mono text-xs text-horror-muted/40">
            NODE #{nodeNum}
          </p>
        )}
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
              onClick={() => onChoice(choice.id, choice.text, choice.nextNodeId)}
            >
              {choice.text}
              <ChevronRight className="ml-1 inline h-3 w-3 opacity-50" />
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
  generatedFeedbackCode,
  feedbackLink,
  reviewerName,
  onReviewerNameChange,
  onSave,
  onRestart,
  onBack,
  hasContent = true,
  onCopyFeedback,
  onCopyLink,
  copiedFeedback,
  copiedLink,
}: {
  fearMarkCount: number;
  feedbackSaved: boolean;
  generatedFeedbackCode: string;
  feedbackLink: string;
  reviewerName: string;
  onReviewerNameChange: (v: string) => void;
  onSave: () => void;
  onRestart: () => void;
  onBack: () => void;
  hasContent?: boolean;
  onCopyFeedback: () => void;
  onCopyLink: () => void;
  copiedFeedback: boolean;
  copiedLink: boolean;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-horror-bg/90 backdrop-blur-sm animate-fade-in overflow-y-auto py-8">
      <div className="text-center max-w-md w-full px-4">
        <Skull className="mx-auto mb-6 h-16 w-16 text-horror-rust animate-glow" />
        {hasContent ? (
          <>
            <h2 className="mb-4 font-creep text-4xl text-horror-rust">体验结束</h2>
            <p className="mb-6 flex items-center justify-center gap-2 text-horror-muted">
              <Eye className="h-4 w-4" />
              你标记了 <span className="font-medium text-horror-rust-light">{fearMarkCount}</span> 处恐惧点
            </p>
          </>
        ) : (
          <>
            <h2 className="mb-4 font-creep text-4xl text-horror-rust">空空如也</h2>
            <p className="mb-6 text-horror-muted">这个对白树还没有内容</p>
          </>
        )}

        {hasContent && (
          <div className="mb-6">
            <label className="mb-2 block text-left text-xs text-horror-muted">
              <User className="mr-1 inline h-3 w-3" />
              你的称呼（可选）
            </label>
            <input
              type="text"
              value={reviewerName}
              onChange={(e) => onReviewerNameChange(e.target.value)}
              placeholder="输入名字让老师知道是谁的反馈"
              className="w-full rounded-lg border border-horror-border bg-horror-panel px-4 py-2.5 text-sm text-horror-text placeholder:text-horror-muted/40 focus:border-horror-rust/50 focus:outline-none"
              disabled={feedbackSaved}
            />
          </div>
        )}

        <div className="flex flex-col items-center gap-3">
          {hasContent && (
            <button
              className="horror-btn-primary w-full max-w-xs"
              onClick={onSave}
              disabled={feedbackSaved}
            >
              {feedbackSaved ? (
                <>
                  <Check className="mr-2 inline h-4 w-4" />
                  反馈已保存
                </>
              ) : (
                '保存反馈'
              )}
            </button>
          )}

          {feedbackSaved && generatedFeedbackCode && (
            <div className="animate-slide-in-up w-full space-y-4 mt-4">
              {feedbackSaved && !generatedFeedbackCode.startsWith('FB-FAILED') && (
                <div className="rounded-lg border border-horror-rust/30 bg-horror-rust/5 px-3 py-2 text-xs text-horror-rust-light animate-fade-in">
                  <Flame className="mr-1 inline h-3 w-3" />
                  反馈已生成，把反馈码发给老师就可以看到啦
                </div>
              )}

              <div>
                <label className="mb-2 block text-left text-xs text-horror-muted">
                  反馈码
                </label>
                <div className="rounded-lg border border-horror-border bg-horror-panel p-3">
                  <textarea
                    readOnly
                    value={generatedFeedbackCode}
                    className="block w-full resize-none border-0 bg-transparent p-0 text-xs font-mono text-horror-muted focus:outline-none"
                    rows={4}
                  />
                </div>
                <button
                  className="horror-btn mt-2 w-full max-w-xs text-xs"
                  onClick={onCopyFeedback}
                >
                  {copiedFeedback ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5 text-horror-rust-light" />
                      已复制反馈码
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      复制反馈码
                    </>
                  )}
                </button>
              </div>

              <div>
                <label className="mb-2 block text-left text-xs text-horror-muted">
                  <Share2 className="mr-1 inline h-3 w-3" />
                  反馈链接
                </label>
                <div className="rounded-lg border border-horror-border bg-horror-panel p-3">
                  <p className="break-all text-xs text-horror-muted/80 line-clamp-2">
                    {feedbackLink}
                  </p>
                </div>
                <button
                  className="horror-btn mt-2 w-full max-w-xs text-xs"
                  onClick={onCopyLink}
                >
                  {copiedLink ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5 text-horror-rust-light" />
                      已复制链接
                    </>
                  ) : (
                    <>
                      <Share2 className="mr-1.5 h-3.5 w-3.5" />
                      生成反馈链接
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              className="horror-btn-ghost flex-1 max-w-[140px]"
              onClick={onRestart}
            >
              重新体验
            </button>
            <button
              className="horror-btn-ghost flex-1 max-w-[140px]"
              onClick={onBack}
            >
              返回题目
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsPanel({
  treeId,
  treeSnapshot,
  onClose,
}: {
  treeId: string;
  treeSnapshot: DialogueTree | null;
  onClose: () => void;
}) {
  const feedbacks = useStore((s) => s.getFeedbacksByTreeId(treeId));
  const trees = useStore((s) => s.trees);
  const tree = trees.find((t) => t.id === treeId) || treeSnapshot;

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

  const fbCodesWithTextMap: FeedbackCode[] = [];
  const nodeTextMapFromCodes: Record<string, string> = {};
  for (const fb of feedbacks) {
    try {
    } catch {
    }
  }

  for (const nodeId of Object.keys(nodeMarkCounts)) {
    if (!nodeMarkCounts[nodeId].text && nodeTextMapFromCodes[nodeId]) {
      nodeMarkCounts[nodeId].text = nodeTextMapFromCodes[nodeId];
    }
  }

  const entries = Object.entries(nodeMarkCounts).filter(([, v]) => v.text);
  const maxCount = Math.max(1, ...entries.map(([, v]) => v.count));
  const totalFearMarks = entries.reduce((sum, [, v]) => sum + v.count, 0);

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
        <div className="mb-3 flex gap-2 text-xs text-horror-muted">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            共 {feedbacks.length} 份反馈
          </span>
          <span className="flex items-center gap-1 text-horror-rust-light">
            <Flame className="h-3 w-3" />
            {totalFearMarks} 处恐惧标记
          </span>
        </div>

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
