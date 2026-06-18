import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@/store';
import {
  Topic, SAMPLE_TOPICS, TopicStats, AssignmentBatch,
  BatchImportResult, NodeFearRanking, DialogueTree, ACT_LABELS,
  ActType, PlaybackFeedback
} from '@/types';
import { generateId, decodeFeedbackCode } from '@/utils';
import {
  Skull, Plus, BookOpen, Trash2, ChevronRight, Flame, GraduationCap, Users, Eye,
  BarChart2, FileDown, Upload, Check, AlertCircle, Copy, TrendingUp, Trophy,
  Calendar, ClipboardList, FolderKanban, PieChart, AlertTriangle, Play, X,
  ArrowRight, Clock, Zap, ChevronDown, ListChecks, XCircle, MessageSquare, UserCheck
} from 'lucide-react';

const formatDate = (ts: number | null | undefined): string => {
  if (!ts) return '未设置';
  return new Date(ts).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatDateShort = (ts: number | null | undefined): string => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function TopicPage() {
  const navigate = useNavigate();
  const [searchParams, _setSearchParams] = useSearchParams();
  const [highlightTopicId, setHighlightTopicId] = useState<string | null>(null);
  const {
    topics, trees, feedbacks, batches, recoveredSnapshots,
    addTopic, removeTopic, getTreeByTopicId, getFeedbacksByTreeId,
    batchImportFeedbackCodes, createBatch, removeBatch, findAnyTree,
    getLatestFeedbackForTree, assignTreeToBatch, getBatchesByTopicId
  } = useStore();

  const [activeTab, setActiveTab] = useState<number>(0);
  const [scrollToTopicId, setScrollToTopicId] = useState<string | null>(null);
  const [accordionState, setAccordionState] = useState<Record<string, boolean>>({});
  const [batchAccordionState, setBatchAccordionState] = useState<Record<string, boolean>>({});
  const [importResult, setImportResult] = useState<BatchImportResult | null>(null);
  const [importDetailTab, setImportDetailTab] = useState<'all' | 'added' | 'skipped' | 'unparsed'>('all');
  const [showUnparsed, setShowUnparsed] = useState(false);
  const [showExportModal, setShowExportModal] = useState<AssignmentBatch | null>(null);
  const [exportCopied, setExportCopied] = useState(false);
  const [groupedImportAccordionState, setGroupedImportAccordionState] = useState<Record<string, boolean>>({});

  const [title, setTitle] = useState('');
  const [scenario, setScenario] = useState('');
  const [constraints, setConstraints] = useState<string[]>([]);
  const [constraintInput, setConstraintInput] = useState('');

  const [bulkCodesInput, setBulkCodesInput] = useState('');
  const [copiedTopicId, setCopiedTopicId] = useState<string | null>(null);
  const [copiedTreeId, setCopiedTreeId] = useState<string | null>(null);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [batchTopicId, setBatchTopicId] = useState('');
  const [batchDescription, setBatchDescription] = useState('');
  const [batchDeadline, setBatchDeadline] = useState('');

  const [batchDetailTab, setBatchDetailTab] = useState<Record<string, 'withFeedback' | 'withoutFeedback' | 'ranking'>>({});

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const highlightParam = searchParams.get('highlightTopic');

    if (tabParam === 'classroom') {
      setActiveTab(1);
    }

    if (highlightParam) {
      setHighlightTopicId(highlightParam);
      setAccordionState((prev) => ({ ...prev, [highlightParam]: true }));
      setTimeout(() => setHighlightTopicId(null), 3000);
    }
  }, [searchParams]);

  const addConstraint = () => {
    const trimmed = constraintInput.trim();
    if (trimmed) {
      setConstraints((prev) => [...prev, trimmed]);
      setConstraintInput('');
    }
  };

  const removeConstraint = (index: number) => {
    setConstraints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    const topic: Topic = {
      id: generateId(),
      title: title.trim(),
      scenario: scenario.trim(),
      constraints,
    };
    addTopic(topic);
    navigate(`/editor/${topic.id}`);
  };

  const handleUseSample = (sample: Topic) => {
    const topic: Topic = {
      id: generateId(),
      title: sample.title,
      scenario: sample.scenario,
      constraints: [...sample.constraints],
    };
    addTopic(topic);
    navigate(`/editor/${topic.id}`);
  };

  const handleConstraintKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addConstraint();
    }
  };

  const handleBulkImport = () => {
    const result = batchImportFeedbackCodes(bulkCodesInput);
    setImportResult(result);

    if (result.affectedTopicIds.length > 0) {
      const newAccordionState: Record<string, boolean> = {};
      const newGroupedAccordionState: Record<string, boolean> = {};
      for (const tid of result.affectedTopicIds) {
        newAccordionState[tid] = true;
        newGroupedAccordionState[tid] = true;
      }
      setAccordionState((prev) => ({ ...prev, ...newAccordionState }));
      setGroupedImportAccordionState((prev) => ({ ...prev, ...newGroupedAccordionState }));
      setScrollToTopicId(result.affectedTopicIds[0]);
    }
  };

  const handleClearBulk = () => {
    setBulkCodesInput('');
    setImportResult(null);
  };

  const topicStats = useMemo<TopicStats[]>(() => {
    const recoveredTreeList = Object.values(recoveredSnapshots);
    return topics.map((topic) => {
      const directTrees = trees.filter((t) => t.topicId === topic.id);
      const recoveredTrees = recoveredTreeList.filter(
        (t) => t.topicId === topic.id && !directTrees.some((d) => d.id === t.id),
      );
      const topicTrees = [...directTrees, ...recoveredTrees];
      let totalFeedbacks = 0;
      let totalMarks = 0;
      for (const tree of topicTrees) {
        const treeFeedbacks = getFeedbacksByTreeId(tree.id);
        totalFeedbacks += treeFeedbacks.length;
        for (const fb of treeFeedbacks) {
          totalMarks += fb.marks.length;
        }
      }
      return {
        topic,
        trees: topicTrees,
        totalFeedbacks,
        totalMarks,
      };
    });
  }, [topics, trees, feedbacks, recoveredSnapshots]);

  useEffect(() => {
    if (scrollToTopicId) {
      setAccordionState((prev) => ({ ...prev, [scrollToTopicId]: true }));
      const timer = setTimeout(() => {
        const el = document.getElementById(`topic-${scrollToTopicId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('animate-pulse-glow');
          setTimeout(() => el.classList.remove('animate-pulse-glow'), 2000);
        }
        setScrollToTopicId(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scrollToTopicId]);

  const handleJumpToTopic = (topicId: string) => {
    setActiveTab(0);
    setScrollToTopicId(topicId);
  };

  const totalTopicsCount = topics.length;
  const totalTreesCount = trees.length + Object.keys(recoveredSnapshots).filter(
    (id) => !trees.some((t) => t.id === id),
  ).length;
  const totalMarksCount = feedbacks.reduce((sum, fb) => sum + fb.marks.length, 0);
  const totalBatchesCount = batches.length;

  const toggleTopicExpand = (topicId: string) => {
    setAccordionState((prev) => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const toggleBatchExpand = (batchId: string) => {
    setBatchAccordionState((prev) => ({ ...prev, [batchId]: !prev[batchId] }));
  };

  const copyTopicUrl = (topicId: string) => {
    const url = `${window.location.origin}/editor/${topicId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedTopicId(topicId);
      setTimeout(() => setCopiedTopicId(null), 2000);
    });
  };

  const copyTreeUrl = (treeId: string) => {
    const url = `${window.location.origin}/play/${treeId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedTreeId(treeId);
      setTimeout(() => setCopiedTreeId(null), 2000);
    });
  };

  const getTopFearNodes = (treeId: string) => {
    const treeFeedbacks = getFeedbacksByTreeId(treeId);
    const nodeCounts: Record<string, number> = {};
    for (const fb of treeFeedbacks) {
      for (const mark of fb.marks) {
        nodeCounts[mark.nodeId] = (nodeCounts[mark.nodeId] || 0) + 1;
      }
    }
    return Object.entries(nodeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  };

  const countDialogueNodes = (tree: DialogueTree) => {
    let count = 0;
    for (const act of tree.acts) {
      count += act.nodes.length;
    }
    return count;
  };

  const handleCreateBatch = () => {
    if (!batchName.trim() || !batchTopicId) return;
    const deadline = batchDeadline ? new Date(batchDeadline).getTime() : null;
    createBatch(batchTopicId, batchName.trim(), batchDescription.trim(), deadline || undefined);
    setShowBatchModal(false);
    setBatchName('');
    setBatchTopicId('');
    setBatchDescription('');
    setBatchDeadline('');
  };

  const handleRemoveBatch = (batchId: string, batchName: string) => {
    if (window.confirm(`确认删除作业批次「${batchName}」？此操作不可撤销。`)) {
      removeBatch(batchId);
    }
  };

  const getBatchTrees = (batch: AssignmentBatch): DialogueTree[] => {
    const allTrees: DialogueTree[] = [
      ...trees,
      ...Object.values(recoveredSnapshots).filter((t) => !trees.some((d) => d.id === t.id)),
    ];
    return allTrees.filter((t) => t.topicId === batch.topicId);
  };

  const getBatchStats = (batch: AssignmentBatch) => {
    const batchTrees = getBatchTrees(batch);
    const totalWorks = batchTrees.length;
    let withFeedback = 0;
    let withoutFeedback = 0;
    for (const tree of batchTrees) {
      const fbCount = getFeedbacksByTreeId(tree.id).length;
      if (fbCount > 0) withFeedback++;
      else withoutFeedback++;
    }
    return { totalWorks, withFeedback, withoutFeedback, trees: batchTrees };
  };

  const getBatchTopFearNodes = (batch: AssignmentBatch) => {
    const batchTrees = getBatchTrees(batch);
    const nodeMarkMap: Record<string, {
      count: number;
      reviewerNames: Set<string>;
      treeId: string;
      authorName: string;
      nodeText: string;
      actType: NodeFearRanking['actType'];
    }> = {};

    for (const tree of batchTrees) {
      const treeFeedbacks = getFeedbacksByTreeId(tree.id);
      for (const fb of treeFeedbacks) {
        for (const mark of fb.marks) {
          if (!nodeMarkMap[mark.nodeId]) {
            let nodeText = '';
            let actType: NodeFearRanking['actType'] = 'opening';
            for (const act of tree.acts) {
              const node = act.nodes.find((n) => n.id === mark.nodeId);
              if (node) {
                nodeText = node.content;
                actType = act.type;
                break;
              }
            }
            nodeMarkMap[mark.nodeId] = {
              count: 0,
              reviewerNames: new Set(),
              treeId: tree.id,
              authorName: tree.authorName || '匿名作者',
              nodeText,
              actType,
            };
          }
          nodeMarkMap[mark.nodeId].count++;
          if (fb.reviewerName) {
            nodeMarkMap[mark.nodeId].reviewerNames.add(fb.reviewerName);
          }
        }
      }
    }

    return Object.values(nodeMarkMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((n) => ({
        nodeId: '',
        nodeText: n.nodeText,
        actType: n.actType,
        markCount: n.count,
        reviewerNames: Array.from(n.reviewerNames),
        treeId: n.treeId,
        authorName: n.authorName,
      }));
  };

  const recoveryRateData = useMemo(() => {
    const allTreeIds = new Set<string>();
    for (const t of trees) allTreeIds.add(t.id);
    for (const id of Object.keys(recoveredSnapshots)) allTreeIds.add(id);
    for (const fb of feedbacks) allTreeIds.add(fb.treeId);

    const totalAssignable = allTreeIds.size;
    let totalFeedbackCount = 0;
    for (const treeId of allTreeIds) {
      totalFeedbackCount += getFeedbacksByTreeId(treeId).length;
    }
    const rate = totalAssignable > 0 ? Math.min(100, Math.round((totalFeedbackCount / totalAssignable) * 100)) : 0;

    let zeroFeedbackWorks = 0;
    for (const treeId of allTreeIds) {
      if (getFeedbacksByTreeId(treeId).length === 0) zeroFeedbackWorks++;
    }

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const topicFeedbackCounts: Record<string, number> = {};
    for (const fb of feedbacks) {
      if (fb.playedAt >= oneWeekAgo) {
        const tree = findAnyTree(fb.treeId);
        if (tree) {
          topicFeedbackCounts[tree.topicId] = (topicFeedbackCounts[tree.topicId] || 0) + 1;
        }
      }
    }
    let mostActiveTopicId = '';
    let maxCount = 0;
    for (const [tid, cnt] of Object.entries(topicFeedbackCounts)) {
      if (cnt > maxCount) {
        maxCount = cnt;
        mostActiveTopicId = tid;
      }
    }
    const mostActiveTopic = topics.find((t) => t.id === mostActiveTopicId);

    const treeMarkCounts: Record<string, number> = {};
    for (const fb of feedbacks) {
      treeMarkCounts[fb.treeId] = (treeMarkCounts[fb.treeId] || 0) + fb.marks.length;
    }
    let mostMarkedTreeId = '';
    let maxMarks = 0;
    for (const [tid, cnt] of Object.entries(treeMarkCounts)) {
      if (cnt > maxMarks) {
        maxMarks = cnt;
        mostMarkedTreeId = tid;
      }
    }
    const mostMarkedTree = mostMarkedTreeId ? findAnyTree(mostMarkedTreeId) : null;

    return {
      rate,
      totalFeedbackCount,
      zeroFeedbackWorks,
      mostActiveTopic,
      mostActiveTopicCount: maxCount,
      mostMarkedTree,
      mostMarkedTreeCount: maxMarks,
    };
  }, [trees, recoveredSnapshots, feedbacks, topics]);

  const globalFearRankings = useMemo<(NodeFearRanking & { treeId: string; authorName: string })[]>(() => {
    const nodeMarkMap: Record<string, {
      count: number;
      reviewerNames: Set<string>;
      treeIds: Set<string>;
    }> = {};

    for (const fb of feedbacks) {
      for (const mark of fb.marks) {
        if (!nodeMarkMap[mark.nodeId]) {
          nodeMarkMap[mark.nodeId] = {
            count: 0,
            reviewerNames: new Set(),
            treeIds: new Set(),
          };
        }
        nodeMarkMap[mark.nodeId].count++;
        if (fb.reviewerName) {
          nodeMarkMap[mark.nodeId].reviewerNames.add(fb.reviewerName);
        }
        nodeMarkMap[mark.nodeId].treeIds.add(fb.treeId);
      }
    }

    const allTrees: DialogueTree[] = [
      ...trees,
      ...Object.values(recoveredSnapshots).filter((t) => !trees.some((d) => d.id === t.id)),
    ];

    const rankings: (NodeFearRanking & { treeId: string; authorName: string })[] = [];

    for (const [nodeId, data] of Object.entries(nodeMarkMap)) {
      let nodeText = '';
      let actType: NodeFearRanking['actType'] = 'opening';
      let treeId = '';
      let authorName = '';

      for (const tid of data.treeIds) {
        const tree = findAnyTree(tid);
        if (tree) {
          treeId = tree.id;
          authorName = tree.authorName || '匿名作者';
          for (const act of tree.acts) {
            const node = act.nodes.find((n) => n.id === nodeId);
            if (node) {
              nodeText = node.content;
              actType = act.type;
              break;
            }
          }
          if (nodeText) break;
        }
      }

      if (!nodeText) {
        nodeText = '(对白内容已丢失)';
      }

      rankings.push({
        nodeId,
        nodeText,
        actType,
        markCount: data.count,
        reviewerNames: Array.from(data.reviewerNames),
        treeId,
        authorName,
      });
    }

    return rankings.sort((a, b) => b.markCount - a.markCount).slice(0, 10);
  }, [feedbacks, trees, recoveredSnapshots]);

  const topMarkCount = globalFearRankings.length > 0 ? globalFearRankings[0].markCount : 1;

  const getAffectedTopics = () => {
    if (!importResult) return [];
    return importResult.affectedTopicIds
      .map((id) => topics.find((t) => t.id === id))
      .filter(Boolean) as Topic[];
  };

  const filteredImportDetails = useMemo(() => {
    if (!importResult) return [];
    if (importDetailTab === 'all') return importResult.details;
    return importResult.details.filter((d) => d.status === importDetailTab);
  }, [importResult, importDetailTab]);

  const getBatchDetailTab = (batchId: string) => {
    return batchDetailTab[batchId] || 'withFeedback';
  };

  const setBatchDetailTabValue = (batchId: string, tab: 'withFeedback' | 'withoutFeedback' | 'ranking') => {
    setBatchDetailTab((prev) => ({ ...prev, [batchId]: tab }));
  };

  function generateBatchMarkdown(
    batch: AssignmentBatch,
    topic: Topic | undefined,
    trees: DialogueTree[],
    feedbacks: PlaybackFeedback[]
  ): string {
    const totalWorks = trees.length;
    let withFeedback = 0;
    let withoutFeedback = 0;
    let totalMarks = 0;
    const treesWithFeedback: DialogueTree[] = [];
    const treesWithoutFeedback: DialogueTree[] = [];

    for (const tree of trees) {
      const treeFeedbacks = feedbacks.filter((fb) => fb.treeId === tree.id);
      const treeMarks = treeFeedbacks.reduce((s, fb) => s + fb.marks.length, 0);
      totalMarks += treeMarks;
      if (treeFeedbacks.length > 0) {
        withFeedback++;
        treesWithFeedback.push(tree);
      } else {
        withoutFeedback++;
        treesWithoutFeedback.push(tree);
      }
    }

    const pct = totalWorks > 0 ? Math.round((withFeedback / totalWorks) * 100) : 0;

    let md = `# ${batch.name}\n`;
    md += `**题目**: ${topic?.title || '未知题目'}\n`;
    md += `**截止日期**: ${formatDate(batch.deadline)}\n`;
    md += `**导出时间**: ${formatDate(Date.now())}\n\n`;

    md += `## 📊 回收进度\n`;
    md += `- **总作品数**: ${totalWorks}\n`;
    md += `- **已交反馈**: ${withFeedback} (${pct}%)\n`;
    md += `- **未交反馈**: ${withoutFeedback}\n`;
    md += `- **总恐惧标记**: ${totalMarks}\n\n`;

    md += `## 🟢 已交反馈作品\n`;
    for (const tree of treesWithFeedback) {
      const treeFeedbacks = feedbacks.filter((fb) => fb.treeId === tree.id);
      const feedbackCount = treeFeedbacks.length;
      const nodeCount = countDialogueNodes(tree);
      const treeMarks = treeFeedbacks.reduce((s, fb) => s + fb.marks.length, 0);
      const latestFeedback = treeFeedbacks.reduce((latest, fb) =>
        !latest || fb.playedAt > latest.playedAt ? fb : latest,
        null as PlaybackFeedback | null
      );

      md += `### ${tree.authorName || '匿名'}\n`;
      md += `- **对白数**: ${nodeCount}\n`;
      md += `- **反馈数**: ${feedbackCount}\n`;
      if (latestFeedback) {
        md += `- **最近反馈**: ${latestFeedback.reviewerName || '匿名'} · ${formatDate(latestFeedback.playedAt)}\n`;
      }
      md += `- **恐惧点数**: ${treeMarks}\n`;

      const topNodes = getTopFearNodes(tree.id);
      if (topNodes.length > 0) {
        md += `- **高恐惧对白**:\n`;
        for (let i = 0; i < topNodes.length; i++) {
          const [nodeId, count] = topNodes[i];
          let nodeContent = '';
          let actType: ActType = 'opening';
          for (const act of tree.acts) {
            const node = act.nodes.find((n) => n.id === nodeId);
            if (node) {
              nodeContent = node.content;
              actType = act.type;
              break;
            }
          }
          const actLabel = ACT_LABELS[actType];
          md += `  - \`#${i + 1}\` [${actLabel}] ${nodeContent.slice(0, 30)}... — ${count}次标记\n`;
        }
      }
      md += '\n';
    }

    md += `## ⚪ 未交反馈作品\n`;
    for (const tree of treesWithoutFeedback) {
      md += `- ${tree.authorName || '匿名'} — 创建于 ${formatDate(tree.createdAt)}\n`;
      md += `- 分享链接: \`/play/${tree.id}\`\n\n`;
    }

    const allTopNodes = getBatchTopFearNodes(batch);
    md += `## 🏆 本批次高恐惧对白 Top 5\n`;
    for (let i = 0; i < allTopNodes.length; i++) {
      const item = allTopNodes[i];
      md += `${i + 1}. \`#${i + 1}\` [${ACT_LABELS[item.actType]}] ${item.nodeText.slice(0, 40)}...\n`;
      md += `   - 作者: ${item.authorName} · ${item.markCount}次标记 · ${item.reviewerNames.length}位同学\n`;
    }

    return md;
  }

  return (
    <div className="min-h-screen bg-horror-bg animate-fade-in">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-10 text-center">
          <Skull className="mx-auto mb-4 h-12 w-12 text-horror-rust animate-glow" />
          <h1 className="font-creep text-5xl text-horror-rust mb-2">暗语</h1>
          <p className="text-lg text-horror-muted">心理恐怖对白树练习器</p>
          <p className="mt-2 text-sm text-horror-muted/70">
            构建令人不安的对话，在言语的裂缝中制造恐惧
          </p>
        </div>

        <div className="mb-8 flex justify-center gap-2">
          <button
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 0
                ? 'bg-horror-rust/15 text-horror-rust'
                : 'text-horror-muted hover:text-horror-rust'
            }`}
            onClick={() => setActiveTab(0)}
          >
            📝 创建设置
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 1
                ? 'bg-horror-rust/15 text-horror-rust'
                : 'text-horror-muted hover:text-horror-rust'
            }`}
            onClick={() => setActiveTab(1)}
          >
            🎓 课堂作业包
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 2
                ? 'bg-horror-rust/15 text-horror-rust'
                : 'text-horror-muted hover:text-horror-rust'
            }`}
            onClick={() => setActiveTab(2)}
          >
            📊 班级回收面板
          </button>
        </div>

        {activeTab === 0 && (
          <div>
            <div className="horror-card mb-8">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-horror-text">
                <Plus className="h-5 w-5 text-horror-rust" />
                创建新题目
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm text-horror-muted">场景标题</label>
                  <input
                    type="text"
                    className="horror-input"
                    placeholder="为你的恐怖场景命名..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm text-horror-muted">情境描述</label>
                  <textarea
                    className="horror-input resize-none"
                    rows={3}
                    placeholder="描述这个场景的恐怖情境..."
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm text-horror-muted">创作约束</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="horror-input flex-1"
                      placeholder="添加一条约束规则..."
                      value={constraintInput}
                      onChange={(e) => setConstraintInput(e.target.value)}
                      onKeyDown={handleConstraintKeyDown}
                    />
                    <button className="horror-btn-ghost" onClick={addConstraint}>
                      添加
                    </button>
                  </div>
                  {constraints.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {constraints.map((c, i) => (
                        <span key={i} className="horror-tag">
                          {c}
                          <button
                            className="ml-1 text-horror-rust-light/60 hover:text-horror-rust-light"
                            onClick={() => removeConstraint(i)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  className="horror-btn-primary w-full"
                  onClick={handleCreate}
                  disabled={!title.trim()}
                >
                  <ChevronRight className="mr-1 inline h-4 w-4" />
                  开始编辑
                </button>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-horror-text">
                <BookOpen className="h-5 w-5 text-horror-rust" />
                示例题库
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin">
                {SAMPLE_TOPICS.map((sample) => (
                  <div
                    key={sample.id}
                    className="horror-card min-w-[260px] flex-shrink-0 hover:shadow-[0_0_20px_rgba(200,75,49,0.15)]"
                  >
                    <h3 className="mb-2 flex items-center gap-2 font-medium text-horror-text">
                      <BookOpen className="h-4 w-4 text-horror-rust/70" />
                      {sample.title}
                    </h3>
                    <p className="mb-3 line-clamp-2 text-sm text-horror-muted">
                      {sample.scenario}
                    </p>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {sample.constraints.map((c, i) => (
                        <span key={i} className="horror-tag text-[10px]">
                          {c}
                        </span>
                      ))}
                    </div>
                    <button
                      className="horror-btn-primary w-full text-xs"
                      onClick={() => handleUseSample(sample)}
                    >
                      使用此题
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {topics.length > 0 && (
              <div>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-horror-text">
                  <Flame className="h-5 w-5 text-horror-rust" />
                  已创建的题目
                </h2>
                <div className="space-y-3">
                  {topics.map((topic) => {
                    const tree = getTreeByTopicId(topic.id);
                    return (
                      <div key={topic.id} className="horror-card flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-horror-text">{topic.title}</h3>
                          <p className="mt-1 truncate text-sm text-horror-muted">
                            {topic.scenario || '无情境描述'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            className="horror-btn-ghost text-xs"
                            onClick={() => navigate(`/editor/${topic.id}`)}
                          >
                            继续编辑
                          </button>
                          {tree && (
                            <button
                              className="horror-btn-ghost text-xs"
                              onClick={() => navigate(`/play/${tree.id}`)}
                            >
                              回放
                            </button>
                          )}
                          <button
                            className="horror-btn-ghost text-xs text-horror-danger hover:text-horror-danger"
                            onClick={() => removeTopic(topic.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 1 && (
          <div className="space-y-8">
            <div className="horror-card">
              <h2 className="mb-2 flex items-center gap-2 text-lg font-medium text-horror-text">
                <Upload className="h-5 w-5 text-horror-rust" />
                批量导入反馈码
              </h2>
              <p className="mb-3 text-sm text-horror-muted">
                粘贴同学发来的反馈码，一行一个，也可直接把一大段聊天记录粘进来，自动识别 FB- 开头的码
              </p>
              <div className="space-y-3">
                <textarea
                  className="horror-input resize-vertical"
                  rows={6}
                  placeholder="FB-xxxxxxxxxxx&#10;FB-yyyyyyyyyyyy&#10;或者直接粘贴聊天记录..."
                  value={bulkCodesInput}
                  onChange={(e) => {
                    setBulkCodesInput(e.target.value);
                  }}
                />
                <div className="flex gap-3">
                  <button
                    className="horror-btn-primary flex-1 flex items-center justify-center gap-2"
                    onClick={handleBulkImport}
                    disabled={!bulkCodesInput.trim()}
                  >
                    <Upload className="h-4 w-4" />
                    批量导入
                  </button>
                  <button
                    className="horror-btn-ghost"
                    onClick={handleClearBulk}
                  >
                    清空
                  </button>
                </div>

                {importResult && (
                  <div className="mt-4 space-y-2">
                    {importResult.added > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border-l-4 border-green-600 bg-green-900/10 px-4 py-2 text-sm text-green-400">
                        <Check className="h-4 w-4 shrink-0" />
                        <span>🟢 新增 {importResult.added} 份反馈</span>
                      </div>
                    )}
                    {importResult.skipped > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border-l-4 border-yellow-600 bg-yellow-900/10 px-4 py-2 text-sm text-yellow-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>🟡 跳过重复 {importResult.skipped} 份</span>
                      </div>
                    )}
                    {importResult.failed > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border-l-4 border-red-600 bg-red-900/10 px-4 py-2 text-sm text-red-400">
                        <XCircle className="h-4 w-4 shrink-0" />
                        <span>🔴 无效码 {importResult.failed} 份</span>
                      </div>
                    )}
                    {importResult.unparsed.length > 0 && (
                      <div>
                        <button
                          className="flex w-full items-center gap-2 rounded-lg border-l-4 border-gray-500 bg-gray-900/10 px-4 py-2 text-sm text-gray-400"
                          onClick={() => setShowUnparsed(!showUnparsed)}
                        >
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span className="flex-1 text-left">⚪ 未识别 {importResult.unparsed.length} 行</span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${showUnparsed ? 'rotate-180' : ''}`} />
                        </button>
                        {showUnparsed && (
                          <div className="mt-2 ml-6 space-y-1 border-l border-gray-700 pl-4">
                            {importResult.unparsed.map((item, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-gray-500">
                                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                                <span className="truncate">{item.line}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {importResult.recoveredTrees > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border-l-4 border-blue-600 bg-blue-900/10 px-4 py-2 text-sm text-blue-400">
                        <FileDown className="h-4 w-4 shrink-0" />
                        <span>🔵 自动恢复作品 {importResult.recoveredTrees} 份</span>
                      </div>
                    )}
                    {importResult.affectedTopicIds.length > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border-l-4 border-purple-600 bg-purple-900/10 px-4 py-2 text-sm text-purple-400">
                        <BookOpen className="h-4 w-4 shrink-0" />
                        <span>📚 涉及 {importResult.affectedTopicIds.length} 个题目</span>
                      </div>
                    )}

                    {importResult.affectedTopicIds.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {(() => {
                          const groupedByTopic: Record<string, typeof importResult.details> = {};
                          for (const d of importResult.details) {
                            if (d.topicId) {
                              if (!groupedByTopic[d.topicId]) {
                                groupedByTopic[d.topicId] = [];
                              }
                              groupedByTopic[d.topicId].push(d);
                            }
                          }

                          const toggleGroupExpand = (topicId: string) => {
                            setGroupedImportAccordionState((prev) => ({
                              ...prev,
                              [topicId]: !prev[topicId],
                            }));
                          };

                          return Object.entries(groupedByTopic).map(([topicId, details]) => {
                            const topic = topics.find((t) => t.id === topicId);
                            if (!topic) return null;
                            const isExpanded = groupedImportAccordionState[topicId] ?? true;
                            const countAdded = details.filter((d) => d.status === 'added').length;
                            const countSkipped = details.filter((d) => d.status === 'skipped').length;
                            const countFailed = details.filter((d) => d.status === 'failed').length;
                            const addedDetails = details.filter((d) => d.status === 'added');
                            const skippedDetails = details.filter((d) => d.status === 'skipped');

                            const getFeedbackOrdinal = (reviewerName: string | undefined, treeId: string | undefined) => {
                              if (!treeId) return '首份反馈';
                              const treeFeedbacks = feedbacks.filter((fb) => fb.treeId === treeId);
                              const reviewerFeedbacks = treeFeedbacks.filter(
                                (fb) => fb.reviewerName === reviewerName
                              );
                              if (reviewerFeedbacks.length <= 1) {
                                const reviewerCount = new Set(
                                  treeFeedbacks.map((fb) => fb.reviewerName || '匿名')
                                ).size;
                                if (reviewerCount === 1) return '首份反馈';
                                return `第 ${reviewerCount} 份反馈`;
                              }
                              return `第 ${reviewerFeedbacks.length} 份反馈`;
                            };

                            return (
                              <div key={topicId} className="rounded-lg border border-horror-border/50 overflow-hidden">
                                <button
                                  className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-horror-card-hover transition-colors"
                                  onClick={() => toggleGroupExpand(topicId)}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <ChevronDown
                                      className={`h-4 w-4 text-horror-muted transition-transform shrink-0 ${
                                        isExpanded ? 'rotate-180' : ''
                                      }`}
                                    />
                                    <BookOpen className="h-4 w-4 text-horror-rust shrink-0" />
                                    <span className="font-medium text-horror-text truncate">{topic.title}</span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 text-xs">
                                    <span className="text-green-400">新增 {countAdded}</span>
                                    <span className="text-horror-muted">/</span>
                                    <span className="text-yellow-400">重复 {countSkipped}</span>
                                    <span className="text-horror-muted">/</span>
                                    <span className="text-red-400">无效 {countFailed}</span>
                                  </div>
                                </button>

                                {isExpanded && (
                                  <div className="border-t border-horror-border/50 p-3 space-y-3">
                                    {addedDetails.length > 0 && (
                                      <div>
                                        <div className="mb-2 text-xs font-medium text-green-400 flex items-center gap-1">
                                          <Check className="h-3 w-3" />
                                          新增反馈
                                        </div>
                                        <div className="rounded-lg border border-green-900/30 bg-green-900/5 p-2 space-y-1">
                                          {addedDetails.map((d, i) => (
                                            <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                              <span className="text-horror-text">
                                                <span className="font-medium">{d.reviewerName || '匿名'}</span>
                                                {': '}
                                                {getFeedbackOrdinal(d.reviewerName, d.treeId)}
                                              </span>
                                              {d.treeId && (
                                                <button
                                                  className="text-horror-rust hover:text-horror-rust-light shrink-0"
                                                  onClick={() => navigate(`/stats/${d.treeId}`)}
                                                >
                                                  去查看 →
                                                </button>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {skippedDetails.length > 0 && (
                                      <div>
                                        <div className="mb-2 text-xs font-medium text-yellow-400 flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          重复跳过
                                        </div>
                                        <div className="rounded-lg border border-yellow-900/30 bg-yellow-900/5 p-2 space-y-1">
                                          {skippedDetails.map((d, i) => (
                                            <div key={i} className="text-xs text-horror-muted">
                                              <span className="font-medium text-yellow-400/80">
                                                {d.reviewerName || '匿名'}
                                              </span>
                                              {': 重复反馈已跳过'}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    <button
                                      className="horror-btn-primary w-full flex items-center justify-center gap-2 text-sm"
                                      onClick={() => handleJumpToTopic(topicId)}
                                    >
                                      进入 {topic.title} 汇总 →
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}

                    {importResult.details.length > 0 && (
                      <div className="mt-4 border-t border-horror-border/50 pt-4">
                        <div className="mb-3 flex gap-1">
                          {(['all', 'added', 'skipped', 'unparsed'] as const).map((tab) => (
                            <button
                              key={tab}
                              className={`rounded px-3 py-1 text-xs transition-colors ${
                                importDetailTab === tab
                                  ? 'bg-horror-rust/15 text-horror-rust'
                                  : 'text-horror-muted hover:text-horror-text'
                              }`}
                              onClick={() => setImportDetailTab(tab)}
                            >
                              {tab === 'all' ? '全部' : tab === 'added' ? '新增' : tab === 'skipped' ? '跳过' : '未识别'}
                            </button>
                          ))}
                        </div>
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {filteredImportDetails.map((d, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full shrink-0 ${
                                  d.status === 'added'
                                    ? 'bg-green-900/30 text-green-400'
                                    : d.status === 'skipped'
                                    ? 'bg-yellow-900/30 text-yellow-400'
                                    : 'bg-red-900/30 text-red-400'
                                }`}
                              >
                                {d.status === 'added' ? '新增' : d.status === 'skipped' ? '跳过' : '无效'}
                              </span>
                              <span className="text-horror-text font-medium shrink-0">{d.reviewerName || '匿名'}</span>
                              <span className="text-horror-muted truncate flex-1">
                                {d.message || d.code.slice(0, 30) + '...'}
                              </span>
                              {d.treeId && (
                                <button
                                  className="text-horror-rust hover:text-horror-rust-light shrink-0"
                                  onClick={() => navigate(`/stats/${d.treeId}`)}
                                >
                                  去查看 →
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {importResult.affectedTopicIds.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-horror-border/50">
                        {importResult.affectedTopicIds.length === 1 ? (
                          <button
                            className="horror-btn-primary w-full flex items-center justify-center gap-2 text-base py-3"
                            onClick={() => handleJumpToTopic(importResult.affectedTopicIds[0])}
                          >
                            <ArrowRight className="h-5 w-5" />
                            直接跳转到该题目汇总 →
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-sm text-horror-muted mb-2">导入涉及多个题目，选择跳转：</div>
                            {getAffectedTopics().map((topic) => (
                              <button
                                key={topic.id}
                                className="horror-btn-ghost w-full flex items-center justify-between text-left"
                                onClick={() => handleJumpToTopic(topic.id)}
                              >
                                <span>查看 {topic.title} 汇总</span>
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 text-xs text-horror-muted/70">
                  累计导入 <span className="text-horror-text font-medium">{feedbacks.length}</span> 份反馈
                </div>
              </div>
            </div>

            <div>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-horror-text">
                <BarChart2 className="h-5 w-5 text-horror-rust" />
                题目汇总
              </h2>
              <div className="space-y-3">
                {topicStats.length === 0 ? (
                  <div className="horror-card text-center py-8 text-horror-muted">
                    暂无题目，先去「创建设置」创建题目吧
                  </div>
                ) : (
                  topicStats.map((stats) => {
                    const isExpanded = accordionState[stats.topic.id] || false;
                    const topicBatches = getBatchesByTopicId(stats.topic.id);
                    return (
                      <div
                        key={stats.topic.id}
                        id={`topic-${stats.topic.id}`}
                        className={`horror-card overflow-hidden transition-all duration-300 ${
                          highlightTopicId === stats.topic.id ? 'ring-2 ring-green-500/50 animate-pulse' : ''
                        }`}
                      >
                        <button
                          className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-horror-card-hover transition-colors"
                          onClick={() => toggleTopicExpand(stats.topic.id)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <BookOpen className="h-5 w-5 text-horror-rust shrink-0" />
                            <span className="font-medium text-horror-text truncate">
                              {stats.topic.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="inline-flex items-center gap-1 rounded-full bg-horror-card-hover px-2.5 py-1 text-xs text-horror-muted">
                              <Users className="h-3.5 w-3.5" />
                              {stats.trees.length} 份作品
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-horror-card-hover px-2.5 py-1 text-xs text-horror-muted">
                              <BarChart2 className="h-3.5 w-3.5" />
                              {stats.totalFeedbacks} 份反馈
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-horror-card-hover px-2.5 py-1 text-xs text-horror-muted">
                              <Flame className="h-3.5 w-3.5" />
                              {stats.totalMarks} 个恐惧点
                            </span>
                            <ChevronDown
                              className={`h-4 w-4 text-horror-muted transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-horror-border/50 p-4 space-y-4">
                            {stats.topic.constraints.length > 0 && (
                              <div>
                                <div className="mb-2 text-xs font-medium text-horror-muted">创作约束</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {stats.topic.constraints.map((c, i) => (
                                    <span key={i} className="horror-tag text-xs">
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {stats.topic.scenario && (
                              <div>
                                <div className="mb-2 text-xs font-medium text-horror-muted">情境描述</div>
                                <p className="text-sm text-horror-muted/90">{stats.topic.scenario}</p>
                              </div>
                            )}

                            <div>
                              <div className="mb-3 text-xs font-medium text-horror-muted">学生作品列表</div>
                              {stats.trees.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-horror-border/50 p-4 text-center">
                                  <p className="text-sm text-horror-muted mb-3">
                                    暂无学生提交作品，把题目分享给学生试试
                                  </p>
                                  <button
                                    className="horror-btn-ghost text-xs inline-flex items-center gap-1.5"
                                    onClick={() => copyTopicUrl(stats.topic.id)}
                                  >
                                    {copiedTopicId === stats.topic.id ? (
                                      <>
                                        <Check className="h-3.5 w-3.5" />
                                        已复制
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3.5 w-3.5" />
                                        复制题目链接
                                      </>
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {stats.trees.map((tree) => {
                                    const resolvedTree = findAnyTree(tree.id) || tree;
                                    const treeFeedbacks = getFeedbacksByTreeId(resolvedTree.id);
                                    const treeMarks = treeFeedbacks.reduce(
                                      (sum, fb) => sum + fb.marks.length,
                                      0,
                                    );
                                    const topNodes = getTopFearNodes(resolvedTree.id);
                                    const latestFeedback = getLatestFeedbackForTree(resolvedTree.id);
                                    return (
                                      <div
                                        key={resolvedTree.id}
                                        className="rounded-lg border border-horror-border/50 p-3 bg-horror-card-hover/30"
                                      >
                                        <div className="flex items-start justify-between mb-2">
                                          <div className="min-w-0">
                                            <div className="text-sm font-medium text-horror-text truncate">
                                              {resolvedTree.authorName || '匿名作者'}
                                            </div>
                                            <div className="text-xs text-horror-muted">
                                              {formatDate(resolvedTree.createdAt)}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3 mb-2 text-xs text-horror-muted">
                                          <span className="inline-flex items-center gap-1">
                                            <MessageSquare className="h-3 w-3" />
                                            {countDialogueNodes(resolvedTree)} 条对白
                                          </span>
                                          <span className="inline-flex items-center gap-1">
                                            <UserCheck className="h-3 w-3" />
                                            {treeFeedbacks.length} 份反馈
                                          </span>
                                          <span className="text-horror-rust inline-flex items-center gap-1">
                                            <Flame className="h-3 w-3" />
                                            {treeMarks} 恐惧点
                                          </span>
                                        </div>

                                        {latestFeedback && (
                                          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-horror-rust/10 px-2 py-1 text-[11px] text-horror-rust">
                                            <UserCheck className="h-3 w-3" />
                                            👤 {latestFeedback.reviewerName || '匿名'} · {formatDateShort(latestFeedback.playedAt)}
                                          </div>
                                        )}

                                        {topNodes.length > 0 && (
                                          <div className="mb-3 space-y-1">
                                            {topNodes.map(([nodeId, count], idx) => {
                                              const maxCount = topNodes[0][1];
                                              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                                              return (
                                                <div key={nodeId} className="flex items-center gap-2">
                                                  <div className="h-1.5 flex-1 rounded-full bg-horror-card-hover overflow-hidden">
                                                    <div
                                                      className="h-full rounded-full bg-horror-rust/80"
                                                      style={{ width: `${pct}%` }}
                                                    />
                                                  </div>
                                                  <span className="text-[10px] text-horror-muted w-6 text-right">
                                                    {count}
                                                  </span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}

                                        <div className="flex items-center gap-1.5 mb-2">
                                          <button
                                            className="horror-btn-primary text-[11px] px-2 py-1 flex-1 flex items-center justify-center gap-1"
                                            onClick={() => navigate(`/stats/${resolvedTree.id}`)}
                                            title="查看统计"
                                          >
                                            <BarChart2 className="h-3 w-3" />
                                            📊 统计
                                          </button>
                                          <button
                                            className="horror-btn-ghost text-[11px] px-2 py-1 flex-1 flex items-center justify-center gap-1"
                                            onClick={() => navigate(`/play/${resolvedTree.id}`)}
                                            title="回放"
                                          >
                                            <Play className="h-3 w-3" />
                                            回放
                                          </button>
                                          <button
                                            className="horror-btn-ghost text-[11px] px-2 py-1 flex-1 flex items-center justify-center gap-1"
                                            onClick={() => navigate(`/editor/${resolvedTree.id}`)}
                                            title="查看/编辑作品"
                                          >
                                            <Eye className="h-3 w-3" />
                                            查看
                                          </button>
                                        </div>

                                        {topicBatches.length > 0 && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-horror-muted">分配到批次:</span>
                                            <select
                                              className="flex-1 rounded border border-horror-border/50 bg-horror-bg px-2 py-1 text-[11px] text-horror-text focus:border-horror-rust focus:outline-none"
                                              defaultValue=""
                                              onChange={(e) => {
                                                if (e.target.value) {
                                                  assignTreeToBatch(e.target.value, resolvedTree.id);
                                                }
                                              }}
                                            >
                                              <option value="" disabled>选择批次</option>
                                              {topicBatches.map((b) => (
                                                <option key={b.id} value={b.id} disabled={b.assignedTreeIds.includes(resolvedTree.id)}>
                                                  {b.name} {b.assignedTreeIds.includes(resolvedTree.id) ? '(已分配)' : ''}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-horror-text">
                <GraduationCap className="h-5 w-5 text-horror-rust" />
                全局统计
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="horror-card text-center">
                  <GraduationCap className="mx-auto mb-2 h-8 w-8 text-horror-rust" />
                  <div className="text-2xl font-bold text-horror-text mb-1">{totalTopicsCount}</div>
                  <div className="text-xs text-horror-muted">题目总数</div>
                </div>
                <div className="horror-card text-center">
                  <Users className="mx-auto mb-2 h-8 w-8 text-horror-rust" />
                  <div className="text-2xl font-bold text-horror-text mb-1">{totalTreesCount}</div>
                  <div className="text-xs text-horror-muted">作品总数</div>
                </div>
                <div className="horror-card text-center">
                  <Flame className="mx-auto mb-2 h-8 w-8 text-horror-rust" />
                  <div className="text-2xl font-bold text-horror-text mb-1">{totalMarksCount}</div>
                  <div className="text-xs text-horror-muted">恐惧标记总数</div>
                </div>
                <div className="horror-card text-center">
                  <ClipboardList className="mx-auto mb-2 h-8 w-8 text-horror-rust" />
                  <div className="text-2xl font-bold text-horror-text mb-1">{totalBatchesCount}</div>
                  <div className="text-xs text-horror-muted">作业批次数</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="space-y-8">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-medium text-horror-text">
                  <FolderKanban className="h-5 w-5 text-horror-rust" />
                  作业批次管理
                </h2>
                <button
                  className="horror-btn-primary text-sm flex items-center gap-1.5"
                  onClick={() => setShowBatchModal(true)}
                >
                  <Plus className="h-4 w-4" />
                  新建作业批次
                </button>
              </div>

              {showBatchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="horror-card w-full max-w-md">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-medium text-horror-text">新建作业批次</h3>
                      <button
                        className="text-horror-muted hover:text-horror-text p-1"
                        onClick={() => setShowBatchModal(false)}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-sm text-horror-muted">批次名称</label>
                        <input
                          type="text"
                          className="horror-input"
                          placeholder="如：第3周作业·深夜来电"
                          value={batchName}
                          onChange={(e) => setBatchName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm text-horror-muted">关联题目</label>
                        <select
                          className="horror-input"
                          value={batchTopicId}
                          onChange={(e) => setBatchTopicId(e.target.value)}
                        >
                          <option value="">-- 请选择题目 --</option>
                          {topics.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm text-horror-muted">描述</label>
                        <textarea
                          className="horror-input resize-none"
                          rows={3}
                          placeholder="作业要求、备注信息..."
                          value={batchDescription}
                          onChange={(e) => setBatchDescription(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm text-horror-muted">截止日期</label>
                        <input
                          type="datetime-local"
                          className="horror-input"
                          value={batchDeadline}
                          onChange={(e) => setBatchDeadline(e.target.value)}
                        />
                      </div>
                      <button
                        className="horror-btn-primary w-full"
                        onClick={handleCreateBatch}
                        disabled={!batchName.trim() || !batchTopicId}
                      >
                        创建批次
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {batches.length === 0 ? (
                <div className="horror-card text-center py-8 text-horror-muted">
                  暂无作业批次，点击「新建作业批次」开始创建
                </div>
              ) : (
                <div className="space-y-3">
                  {batches.map((batch) => {
                    const topic = topics.find((t) => t.id === batch.topicId);
                    const batchStats = getBatchStats(batch);
                    const progressPct = batchStats.totalWorks > 0
                      ? Math.min(100, Math.round((batchStats.withFeedback / batchStats.totalWorks) * 100))
                      : 0;
                    const isExpanded = batchAccordionState[batch.id] || false;
                    const currentTab = getBatchDetailTab(batch.id);
                    const topFearNodes = getBatchTopFearNodes(batch);
                    const batchTopMarkCount = topFearNodes.length > 0 ? topFearNodes[0].markCount : 1;

                    const treesWithFeedback = batchStats.trees.filter(
                      (t) => getFeedbacksByTreeId(t.id).length > 0
                    );
                    const treesWithoutFeedback = batchStats.trees.filter(
                      (t) => getFeedbacksByTreeId(t.id).length === 0
                    );

                    return (
                      <div key={batch.id} className="horror-card overflow-hidden">
                        <button
                          className="w-full p-4 text-left hover:bg-horror-card-hover transition-colors"
                          onClick={() => toggleBatchExpand(batch.id)}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <FolderKanban className="h-5 w-5 text-horror-rust shrink-0" />
                                <h3 className="font-medium text-horror-text truncate">{batch.name}</h3>
                              </div>
                              <div className="text-xs text-horror-muted space-y-0.5">
                                <div>所属题目: {topic?.title || '题目已删除'}</div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  截止日期: {formatDate(batch.deadline)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="horror-btn-ghost text-xs p-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowExportModal(batch);
                                  setExportCopied(false);
                                }}
                                title="导出汇总"
                              >
                                📋 导出汇总
                              </button>
                              <button
                                className="horror-btn-ghost text-xs text-horror-danger hover:text-horror-danger p-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveBatch(batch.id, batch.name);
                                }}
                                title="删除批次"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <ChevronDown
                                className={`h-4 w-4 text-horror-muted transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </div>
                          </div>
                          {batch.description && (
                            <div className="mb-3 text-xs text-horror-muted/90 bg-horror-card-hover/30 rounded p-2">
                              {batch.description}
                            </div>
                          )}
                          <div className="mb-3">
                            <div className="flex justify-between text-xs text-horror-muted mb-1">
                              <span>已收到反馈 / 总作品</span>
                              <span>{batchStats.withFeedback} / {batchStats.totalWorks}</span>
                            </div>
                            <div className="h-2 rounded-full bg-horror-card-hover overflow-hidden">
                              <div
                                className="h-full rounded-full bg-horror-rust/80 transition-all"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 rounded-full bg-horror-card-hover px-2.5 py-1 text-xs text-horror-muted">
                              <Users className="h-3.5 w-3.5" />
                              {batchStats.totalWorks} 份作品
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-900/20 px-2.5 py-1 text-xs text-green-400">
                              <Check className="h-3.5 w-3.5" />
                              {batchStats.withFeedback} 份已反馈
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-900/20 px-2.5 py-1 text-xs text-yellow-400">
                              <Clock className="h-3.5 w-3.5" />
                              {batchStats.withoutFeedback} 份未反馈
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-horror-border/50 p-4">
                            <div className="mb-4 flex gap-1 border-b border-horror-border/50">
                              <button
                                className={`px-4 py-2 text-xs font-medium transition-colors ${
                                  currentTab === 'withFeedback'
                                    ? 'text-horror-rust border-b-2 border-horror-rust'
                                    : 'text-horror-muted hover:text-horror-text'
                                }`}
                                onClick={() => setBatchDetailTabValue(batch.id, 'withFeedback')}
                              >
                                🟢 已交反馈作品
                              </button>
                              <button
                                className={`px-4 py-2 text-xs font-medium transition-colors ${
                                  currentTab === 'withoutFeedback'
                                    ? 'text-horror-rust border-b-2 border-horror-rust'
                                    : 'text-horror-muted hover:text-horror-text'
                                }`}
                                onClick={() => setBatchDetailTabValue(batch.id, 'withoutFeedback')}
                              >
                                ⚪ 未交反馈作品
                              </button>
                              <button
                                className={`px-4 py-2 text-xs font-medium transition-colors ${
                                  currentTab === 'ranking'
                                    ? 'text-horror-rust border-b-2 border-horror-rust'
                                    : 'text-horror-muted hover:text-horror-text'
                                }`}
                                onClick={() => setBatchDetailTabValue(batch.id, 'ranking')}
                              >
                                🏆 本批次高恐惧排行
                              </button>
                            </div>

                            {currentTab === 'withFeedback' && (
                              <div className="space-y-2 max-h-96 overflow-y-auto">
                                {treesWithFeedback.length === 0 ? (
                                  <div className="text-center py-6 text-horror-muted text-sm">
                                    暂无已反馈作品
                                  </div>
                                ) : (
                                  treesWithFeedback.map((tree) => {
                                    const treeFeedbacks = getFeedbacksByTreeId(tree.id);
                                    const treeMarks = treeFeedbacks.reduce((s, fb) => s + fb.marks.length, 0);
                                    const latestFb = getLatestFeedbackForTree(tree.id);
                                    return (
                                      <div key={tree.id} className="rounded-lg border border-horror-border/50 p-3 bg-horror-card-hover/30 flex items-center justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <div className="text-sm font-medium text-horror-text truncate">
                                            {tree.authorName || '匿名作者'}
                                          </div>
                                          <div className="flex items-center gap-3 text-xs text-horror-muted mt-1">
                                            <span className="inline-flex items-center gap-1">
                                              <UserCheck className="h-3 w-3" />
                                              最近: {latestFb?.reviewerName || '匿名'}
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                              <MessageSquare className="h-3 w-3" />
                                              {treeFeedbacks.length} 反馈
                                            </span>
                                            <span className="text-horror-rust inline-flex items-center gap-1">
                                              <Flame className="h-3 w-3" />
                                              {treeMarks} 恐惧点
                                            </span>
                                          </div>
                                        </div>
                                        <button
                                          className="horror-btn-ghost text-xs shrink-0"
                                          onClick={() => navigate(`/stats/${tree.id}`)}
                                        >
                                          📊去统计
                                        </button>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}

                            {currentTab === 'withoutFeedback' && (
                              <div className="space-y-2 max-h-96 overflow-y-auto">
                                {treesWithoutFeedback.length === 0 ? (
                                  <div className="text-center py-6 text-horror-muted text-sm">
                                    所有作品都已收到反馈，太棒了！
                                  </div>
                                ) : (
                                  treesWithoutFeedback.map((tree) => (
                                    <div key={tree.id} className="rounded-lg border border-horror-border/50 p-3 bg-horror-card-hover/30 flex items-center justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-horror-text truncate">
                                          {tree.authorName || '匿名作者'}
                                        </div>
                                        <div className="text-xs text-horror-muted mt-1">
                                          创建于 {formatDateShort(tree.createdAt)}
                                        </div>
                                      </div>
                                      <button
                                        className="horror-btn-ghost text-xs shrink-0 inline-flex items-center gap-1"
                                        onClick={() => copyTreeUrl(tree.id)}
                                      >
                                        {copiedTreeId === tree.id ? (
                                          <>
                                            <Check className="h-3 w-3" />
                                            已复制
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="h-3 w-3" />
                                            分享链接
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}

                            {currentTab === 'ranking' && (
                              <div className="space-y-2 max-h-96 overflow-y-auto">
                                {topFearNodes.length === 0 ? (
                                  <div className="text-center py-6 text-horror-muted text-sm">
                                    暂无恐惧标记数据
                                  </div>
                                ) : (
                                  topFearNodes.map((item, index) => {
                                    const heatPct = batchTopMarkCount > 0 ? (item.markCount / batchTopMarkCount) * 100 : 0;
                                    const medalIcon = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
                                    return (
                                      <div key={index} className="rounded-lg border border-horror-border/50 p-3">
                                        <div className="flex items-start gap-3">
                                          <div className="shrink-0 w-8 text-center">
                                            {medalIcon ? (
                                              <span className="text-lg">{medalIcon}</span>
                                            ) : (
                                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-horror-card-hover text-horror-muted text-[11px] font-bold">
                                                #{index + 1}
                                              </span>
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-horror-rust/15 text-horror-rust text-[10px] font-medium">
                                                {ACT_LABELS[item.actType]}
                                              </span>
                                              <span className="text-[10px] text-horror-muted/70">
                                                {item.authorName}
                                              </span>
                                            </div>
                                            <div className="text-xs text-horror-text/90 mb-2 line-clamp-2">
                                              {item.nodeText}
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="h-1.5 flex-1 rounded-full bg-horror-card-hover overflow-hidden">
                                                <div
                                                  className="h-full rounded-full bg-horror-rust/80"
                                                  style={{ width: `${heatPct}%` }}
                                                />
                                              </div>
                                              <span className="text-[10px] text-horror-rust inline-flex items-center gap-1">
                                                <Flame className="h-3 w-3" />
                                                {item.markCount}
                                              </span>
                                              <button
                                                className="text-[10px] text-horror-rust hover:text-horror-rust-light"
                                                onClick={() => navigate(`/stats/${item.treeId}`)}
                                              >
                                                去统计 →
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-horror-text">
                <PieChart className="h-5 w-5 text-horror-rust" />
                回收进度总览
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="horror-card text-center">
                  <PieChart className="mx-auto mb-2 h-8 w-8 text-horror-rust" />
                  <div className="text-2xl font-bold text-horror-text mb-1">{recoveryRateData.rate}%</div>
                  <div className="text-xs text-horror-muted">总反馈回收率</div>
                </div>
                <div className="horror-card text-center">
                  <TrendingUp className="mx-auto mb-2 h-8 w-8 text-horror-rust" />
                  <div className="text-2xl font-bold text-horror-text mb-1">{recoveryRateData.zeroFeedbackWorks}</div>
                  <div className="text-xs text-horror-muted">未回收作品数</div>
                </div>
                <div className="horror-card text-center">
                  <Calendar className="mx-auto mb-2 h-8 w-8 text-horror-rust" />
                  <div className="text-lg font-bold text-horror-text mb-1 truncate px-1" title={recoveryRateData.mostActiveTopic?.title}>
                    {recoveryRateData.mostActiveTopic?.title?.slice(0, 8) || '暂无'}
                  </div>
                  <div className="text-xs text-horror-muted">
                    最活跃题目 {recoveryRateData.mostActiveTopic ? `(${recoveryRateData.mostActiveTopicCount}份)` : ''}
                  </div>
                </div>
                <div className="horror-card text-center">
                  <Trophy className="mx-auto mb-2 h-8 w-8 text-horror-rust" />
                  <div className="text-lg font-bold text-horror-text mb-1 truncate px-1" title={recoveryRateData.mostMarkedTree?.authorName || ''}>
                    {recoveryRateData.mostMarkedTree ? recoveryRateData.mostMarkedTree.authorName?.slice(0, 8) || '匿名' : '暂无'}
                  </div>
                  <div className="text-xs text-horror-muted">
                    标记最多作品 {recoveryRateData.mostMarkedTree ? `(${recoveryRateData.mostMarkedTreeCount}点)` : ''}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-horror-text">
                <Trophy className="h-5 w-5 text-horror-rust" />
                全题库高恐惧对白 Top 10
              </h2>
              {globalFearRankings.length === 0 ? (
                <div className="horror-card text-center py-8 text-horror-muted">
                  暂无恐惧标记数据，需要先导入反馈
                </div>
              ) : (
                <div className="space-y-3">
                  {globalFearRankings.map((item, index) => {
                    const heatPct = topMarkCount > 0 ? (item.markCount / topMarkCount) * 100 : 0;
                    const medalIcon = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
                    const topic = topics.find((t) => {
                      const tree = findAnyTree(item.treeId);
                      return tree && t.id === tree.topicId;
                    });
                    const topicTreeCount = topic ? topicStats.find((s) => s.topic.id === topic.id)?.trees.length || 0 : 0;
                    return (
                      <div key={item.nodeId} className="horror-card">
                        <div className="flex items-start gap-3">
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
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-horror-rust/15 text-horror-rust text-[11px] font-medium">
                                {ACT_LABELS[item.actType]}
                              </span>
                              {item.authorName && (
                                <span className="text-[11px] text-horror-muted/70 inline-flex items-center gap-1">
                                  <UserCheck className="h-3 w-3" />
                                  {item.authorName}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-horror-text/90 mb-3 max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                              {item.nodeText}
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
                                <span className="inline-flex items-center gap-1 text-horror-rust">
                                  <Flame className="h-3.5 w-3.5" />
                                  {item.markCount}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5" />
                                  {item.reviewerNames.length > 0 ? `${item.reviewerNames.length} 人标记` : '匿名标记'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {topicTreeCount > 1 && topic && (
                                  <button
                                    className="horror-btn-ghost text-[11px] flex items-center gap-1"
                                    onClick={() => navigate(`/review/${topic.id}`)}
                                  >
                                    <BarChart2 className="h-3 w-3" />
                                    跳转课程复盘
                                  </button>
                                )}
                                {item.treeId && (
                                  <button
                                    className="horror-btn-ghost text-[11px] flex items-center gap-1"
                                    onClick={() => navigate(`/stats/${item.treeId}`)}
                                  >
                                    <BarChart2 className="h-3 w-3" />
                                    查看作品统计
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {showExportModal && (() => {
          const topic = topics.find((t) => t.id === showExportModal.topicId);
          const batchTrees = getBatchTrees(showExportModal);
          const batchFeedbacks = feedbacks.filter((fb) => batchTrees.some((t) => t.id === fb.treeId));
          const markdown = generateBatchMarkdown(showExportModal, topic, batchTrees, batchFeedbacks);

          const handleCopy = () => {
            navigator.clipboard?.writeText(markdown).then(() => {
              setExportCopied(true);
              setTimeout(() => setExportCopied(false), 2000);
            });
          };

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="horror-card w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-medium text-horror-text">
                    {showExportModal.name} - 课堂汇总
                  </h3>
                  <button
                    className="text-horror-muted hover:text-horror-text p-1"
                    onClick={() => setShowExportModal(null)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <textarea
                  className="horror-input resize-vertical flex-1 min-h-[300px] font-mono text-xs"
                  value={markdown}
                  readOnly
                  ref={(el) => {
                    if (el) {
                      el.select();
                    }
                  }}
                />
                <div className="mt-4 flex gap-3">
                  <button
                    className="horror-btn-primary flex-1 flex items-center justify-center gap-2"
                    onClick={handleCopy}
                  >
                    {exportCopied ? (
                      <>
                        <Check className="h-4 w-4" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        📋 一键复制 Markdown
                      </>
                    )}
                  </button>
                  <button
                    className="horror-btn-ghost"
                    onClick={() => setShowExportModal(null)}
                  >
                    关闭
                  </button>
                  <button
                    className="horror-btn-primary flex items-center justify-center gap-2"
                    onClick={() => {
                      setShowExportModal(null);
                      navigate(`/review/${showExportModal.topicId}`);
                    }}
                  >
                    跳转到课程复盘 →
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}