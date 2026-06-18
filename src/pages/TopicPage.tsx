import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { Topic, SAMPLE_TOPICS, TopicStats, DialogueTree } from '@/types';
import { generateId, decodeFeedbackCode } from '@/utils';
import { Skull, Plus, BookOpen, Trash2, ChevronRight, Flame, GraduationCap, Users, Eye, BarChart2, FileDown, Upload, Check, AlertCircle, Copy } from 'lucide-react';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TopicPage() {
  const navigate = useNavigate();
  const {
    topics,
    trees,
    feedbacks,
    addTopic,
    removeTopic,
    getTreeByTopicId,
    getFeedbacksByTreeId,
    importFeedback,
    importTreeSnapshot,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'create' | 'classroom'>('create');

  const [title, setTitle] = useState('');
  const [scenario, setScenario] = useState('');
  const [constraints, setConstraints] = useState<string[]>([]);
  const [constraintInput, setConstraintInput] = useState('');

  const [feedbackCodeInput, setFeedbackCodeInput] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [copiedTopicId, setCopiedTopicId] = useState<string | null>(null);

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

  const handleImportFeedback = () => {
    setImportError('');
    setImportSuccess('');

    const code = feedbackCodeInput.trim();
    if (!code) {
      setImportError('请输入反馈码');
      return;
    }

    const decoded = decodeFeedbackCode(code);
    if (!decoded) {
      setImportError('无效的反馈码，请检查是否正确复制了完整的 FB- 开头的内容');
      return;
    }

    if (decoded.treeSnapshot) {
      const existingTree = trees.find((t) => t.id === decoded.treeSnapshot!.id);
      if (!existingTree) {
        importTreeSnapshot(decoded.treeSnapshot);
      }
    }

    const feedback = {
      treeId: decoded.treeId,
      marks: decoded.marks,
      playedAt: decoded.playedAt,
      reviewerName: decoded.reviewerName,
    };

    importFeedback(feedback, decoded.treeSnapshot);

    setImportSuccess(`已导入 ${decoded.marks.length} 个恐惧标记，来自 ${decoded.reviewerName || '匿名'}`);
    setFeedbackCodeInput('');
  };

  const topicStats = useMemo<TopicStats[]>(() => {
    return topics.map((topic) => {
      const topicTrees = trees.filter((t) => t.topicId === topic.id);
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
  }, [topics, trees, feedbacks]);

  const totalTopicsCount = topics.length;
  const totalTreesCount = trees.length;
  const totalMarksCount = feedbacks.reduce((sum, fb) => sum + fb.marks.length, 0);

  const toggleTopicExpand = (topicId: string) => {
    setExpandedTopics((prev) => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const copyTopicUrl = (topicId: string) => {
    const url = `${window.location.origin}/editor/${topicId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedTopicId(topicId);
      setTimeout(() => setCopiedTopicId(null), 2000);
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

  return (
    <div className="min-h-screen bg-horror-bg animate-fade-in">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-10 text-center">
          <Skull className="mx-auto mb-4 h-12 w-12 text-horror-rust animate-glow" />
          <h1 className="font-creep text-5xl text-horror-rust mb-2">暗语</h1>
          <p className="text-lg text-horror-muted">心理恐怖对白树练习器</p>
          <p className="mt-2 text-sm text-horror-muted/70">
            构建令人不安的对话，在言语的裂缝中制造恐惧
          </p>
        </div>

        <div className="mb-8 flex justify-center border-b border-horror-border/50">
          <button
            className={`relative px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'create'
                ? 'text-horror-rust'
                : 'text-horror-muted hover:text-horror-text'
            }`}
            onClick={() => setActiveTab('create')}
          >
            📝 创建设置
            {activeTab === 'create' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-horror-rust" />
            )}
          </button>
          <button
            className={`relative px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'classroom'
                ? 'text-horror-rust'
                : 'text-horror-muted hover:text-horror-text'
            }`}
            onClick={() => setActiveTab('classroom')}
          >
            🎓 课堂作业包
            {activeTab === 'classroom' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-horror-rust" />
            )}
          </button>
        </div>

        {activeTab === 'create' && (
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

        {activeTab === 'classroom' && (
          <div className="space-y-8">
            <div className="horror-card">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-horror-text">
                <Upload className="h-5 w-5 text-horror-rust" />
                导入反馈码
              </h2>
              <div className="space-y-3">
                <textarea
                  className={`horror-input resize-none ${
                    importError ? 'border-horror-danger focus:border-horror-danger' : ''
                  }`}
                  rows={3}
                  placeholder="粘贴同学发来的 FB- 开头的反馈码..."
                  value={feedbackCodeInput}
                  onChange={(e) => {
                    setFeedbackCodeInput(e.target.value);
                    setImportError('');
                    setImportSuccess('');
                  }}
                />
                <button
                  className="horror-btn-primary w-full flex items-center justify-center gap-2"
                  onClick={handleImportFeedback}
                >
                  <FileDown className="h-4 w-4" />
                  导入反馈
                </button>
                {importError && (
                  <div className="flex items-start gap-2 rounded-lg bg-horror-danger/10 p-3 text-sm text-horror-danger">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}
                {importSuccess && (
                  <div className="flex items-start gap-2 rounded-lg bg-horror-rust/10 p-3 text-sm text-horror-rust">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{importSuccess}</span>
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
                题目汇总表
              </h2>
              <div className="space-y-3">
                {topicStats.length === 0 ? (
                  <div className="horror-card text-center py-8 text-horror-muted">
                    暂无题目，先去「创建设置」创建题目吧
                  </div>
                ) : (
                  topicStats.map((stats) => {
                    const isExpanded = expandedTopics[stats.topic.id] || false;
                    return (
                      <div key={stats.topic.id} className="horror-card overflow-hidden">
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
                            <ChevronRight
                              className={`h-4 w-4 text-horror-muted transition-transform ${
                                isExpanded ? 'rotate-90' : ''
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
                                    const treeFeedbacks = getFeedbacksByTreeId(tree.id);
                                    const treeMarks = treeFeedbacks.reduce(
                                      (sum, fb) => sum + fb.marks.length,
                                      0,
                                    );
                                    const topNodes = getTopFearNodes(tree.id);
                                    return (
                                      <div
                                        key={tree.id}
                                        className="rounded-lg border border-horror-border/50 p-3 bg-horror-card-hover/30"
                                      >
                                        <div className="flex items-start justify-between mb-2">
                                          <div className="min-w-0">
                                            <div className="text-sm font-medium text-horror-text truncate">
                                              {tree.authorName || '匿名作者'}
                                            </div>
                                            <div className="text-xs text-horror-muted">
                                              {formatDate(tree.createdAt)}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3 mb-3 text-xs text-horror-muted">
                                          <span>{countDialogueNodes(tree)} 条对白</span>
                                          <span>{treeFeedbacks.length} 份反馈</span>
                                          <span className="text-horror-rust">{treeMarks} 恐惧点</span>
                                        </div>

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

                                        <div className="flex items-center gap-1.5">
                                          <button
                                            className="horror-btn-ghost text-[11px] px-2 py-1 flex-1 flex items-center justify-center gap-1"
                                            onClick={() => navigate(`/editor/${tree.id}`)}
                                            title="查看/编辑作品"
                                          >
                                            <Eye className="h-3 w-3" />
                                            查看
                                          </button>
                                          <button
                                            className="horror-btn-ghost text-[11px] px-2 py-1 flex-1 flex items-center justify-center gap-1"
                                            onClick={() => navigate(`/play/${tree.id}`)}
                                            title="回放"
                                          >
                                            <ChevronRight className="h-3 w-3" />
                                            回放
                                          </button>
                                          <button
                                            className="horror-btn-ghost text-[11px] px-2 py-1 flex-1 flex items-center justify-center gap-1"
                                            onClick={() => navigate(`/play/${tree.id}?stats=1`)}
                                            title="统计"
                                          >
                                            <BarChart2 className="h-3 w-3" />
                                            统计
                                          </button>
                                        </div>
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
              <div className="grid grid-cols-3 gap-3">
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
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
