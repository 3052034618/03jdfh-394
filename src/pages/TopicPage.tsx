import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { Topic, SAMPLE_TOPICS } from '@/types';
import { generateId } from '@/utils';
import { Skull, Plus, BookOpen, Trash2, ChevronRight, Flame } from 'lucide-react';

export default function TopicPage() {
  const navigate = useNavigate();
  const { topics, addTopic, removeTopic, getTreeByTopicId } = useStore();

  const [title, setTitle] = useState('');
  const [scenario, setScenario] = useState('');
  const [constraints, setConstraints] = useState<string[]>([]);
  const [constraintInput, setConstraintInput] = useState('');

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

  return (
    <div className="min-h-screen bg-horror-bg animate-fade-in">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-10 text-center">
          <Skull className="mx-auto mb-4 h-12 w-12 text-horror-rust animate-glow" />
          <h1 className="font-creep text-5xl text-horror-rust mb-2">暗语</h1>
          <p className="text-lg text-horror-muted">心理恐怖对白树练习器</p>
          <p className="mt-2 text-sm text-horror-muted/70">
            构建令人不安的对话，在言语的裂缝中制造恐惧
          </p>
        </div>

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
    </div>
  );
}
