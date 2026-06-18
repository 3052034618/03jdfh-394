import { create } from 'zustand';
import type {
  Topic,
  DialogueTree,
  DialogueNode,
  Act,
  PlayerChoice,
  PlaybackFeedback,
  FearMark,
  AssignmentBatch,
  BatchImportResult,
  FeedbackCode,
} from '@/types';
import { ActType } from '@/types';
import { generateId, decodeFeedbackCode } from '@/utils';

interface AppState {
  topics: Topic[];
  trees: DialogueTree[];
  feedbacks: PlaybackFeedback[];
  batches: AssignmentBatch[];
  recoveredSnapshots: Record<string, DialogueTree>;

  addTopic: (topic: Topic) => void;
  updateTopic: (id: string, updates: Partial<Topic>) => void;
  removeTopic: (id: string) => void;

  createTree: (topicId: string, authorName: string) => DialogueTree;
  updateTree: (id: string, updates: Partial<DialogueTree>) => void;
  removeTree: (id: string) => void;
  getTreeById: (id: string) => DialogueTree | undefined;
  getTreeByTopicId: (topicId: string) => DialogueTree | undefined;
  getTreesByTopicId: (topicId: string) => DialogueTree[];
  findAnyTree: (id: string) => DialogueTree | null;

  addNode: (treeId: string, actId: string, node: DialogueNode) => void;
  updateNode: (treeId: string, nodeId: string, updates: Partial<DialogueNode>) => void;
  removeNode: (treeId: string, actId: string, nodeId: string) => void;

  addChoice: (treeId: string, nodeId: string, choice: PlayerChoice) => void;
  updateChoice: (treeId: string, nodeId: string, choiceId: string, updates: Partial<PlayerChoice>) => void;
  removeChoice: (treeId: string, nodeId: string, choiceId: string) => void;

  addFeedback: (feedback: PlaybackFeedback) => void;
  addFearMark: (treeId: string, mark: FearMark) => void;
  getFeedbacksByTreeId: (treeId: string) => PlaybackFeedback[];

  importFeedback: (feedback: PlaybackFeedback, treeSnapshot?: DialogueTree | null) => void;
  importTreeSnapshot: (snapshot: DialogueTree) => void;

  createBatch: (topicId: string, name: string, description?: string, deadline?: number) => AssignmentBatch;
  updateBatch: (id: string, updates: Partial<AssignmentBatch>) => void;
  removeBatch: (id: string) => void;
  getBatchesByTopicId: (topicId: string) => AssignmentBatch[];
  assignTreeToBatch: (batchId: string, treeId: string) => void;
  unassignTreeFromBatch: (batchId: string, treeId: string) => void;

  isFeedbackDuplicate: (feedback: PlaybackFeedback, existing?: PlaybackFeedback[]) => boolean;
  importFeedbackCode: (code: string) => BatchImportResult['details'][number];
  batchImportFeedbackCodes: (codesText: string) => BatchImportResult;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function createDefaultActs(): Act[] {
  const types: ActType[] = ['opening', 'anomaly', 'collapse'];
  return types.map((type, index) => ({
    id: generateId(),
    type,
    order: index,
    nodes: [],
  }));
}

export const useStore = create<AppState>((set, get) => ({
  topics: loadFromStorage<Topic[]>('horror-topics', []),
  trees: loadFromStorage<DialogueTree[]>('horror-trees', []),
  feedbacks: loadFromStorage<PlaybackFeedback[]>('horror-feedbacks', []),
  batches: loadFromStorage<AssignmentBatch[]>('horror-batches', []),
  recoveredSnapshots: loadFromStorage<Record<string, DialogueTree>>('horror-recovered-snapshots', {}),

  addTopic: (topic) => {
    set((state) => {
      const topics = [...state.topics, topic];
      saveToStorage('horror-topics', topics);
      return { topics };
    });
  },

  updateTopic: (id, updates) => {
    set((state) => {
      const topics = state.topics.map((t) => (t.id === id ? { ...t, ...updates } : t));
      saveToStorage('horror-topics', topics);
      return { topics };
    });
  },

  removeTopic: (id) => {
    set((state) => {
      const topics = state.topics.filter((t) => t.id !== id);
      saveToStorage('horror-topics', topics);
      return { topics };
    });
  },

  createTree: (topicId, authorName) => {
    const tree: DialogueTree = {
      id: generateId(),
      topicId,
      authorName,
      acts: createDefaultActs(),
      createdAt: Date.now(),
    };
    set((state) => {
      const trees = [...state.trees, tree];
      saveToStorage('horror-trees', trees);
      return { trees };
    });
    return tree;
  },

  updateTree: (id, updates) => {
    set((state) => {
      const trees = state.trees.map((t) => (t.id === id ? { ...t, ...updates } : t));
      saveToStorage('horror-trees', trees);
      return { trees };
    });
  },

  removeTree: (id) => {
    set((state) => {
      const trees = state.trees.filter((t) => t.id !== id);
      saveToStorage('horror-trees', trees);
      return { trees };
    });
  },

  getTreeById: (id) => {
    return get().trees.find((t) => t.id === id);
  },

  getTreeByTopicId: (topicId) => {
    return get().trees.find((t) => t.topicId === topicId);
  },

  getTreesByTopicId: (topicId) => {
    return get().trees.filter((t) => t.topicId === topicId);
  },

  findAnyTree: (id) => {
    const direct = get().trees.find((t) => t.id === id);
    if (direct) return direct;
    const recovered = get().recoveredSnapshots[id];
    if (recovered) return recovered;
    for (const fb of get().feedbacks) {
      // noop just in case, snapshots stored separately
    }
    return null;
  },

  addNode: (treeId, actId, node) => {
    set((state) => {
      const trees = state.trees.map((tree) => {
        if (tree.id !== treeId) return tree;
        return {
          ...tree,
          acts: tree.acts.map((act) => {
            if (act.id !== actId) return act;
            return { ...act, nodes: [...act.nodes, node] };
          }),
        };
      });
      saveToStorage('horror-trees', trees);
      return { trees };
    });
  },

  updateNode: (treeId, nodeId, updates) => {
    set((state) => {
      const trees = state.trees.map((tree) => {
        if (tree.id !== treeId) return tree;
        return {
          ...tree,
          acts: tree.acts.map((act) => ({
            ...act,
            nodes: act.nodes.map((node) => (node.id === nodeId ? { ...node, ...updates } : node)),
          })),
        };
      });
      saveToStorage('horror-trees', trees);
      return { trees };
    });
  },

  removeNode: (treeId, actId, nodeId) => {
    set((state) => {
      const trees = state.trees.map((tree) => {
        if (tree.id !== treeId) return tree;
        return {
          ...tree,
          acts: tree.acts.map((act) => {
            if (act.id !== actId) return act;
            return { ...act, nodes: act.nodes.filter((n) => n.id !== nodeId) };
          }),
        };
      });
      saveToStorage('horror-trees', trees);
      return { trees };
    });
  },

  addChoice: (treeId, nodeId, choice) => {
    set((state) => {
      const trees = state.trees.map((tree) => {
        if (tree.id !== treeId) return tree;
        return {
          ...tree,
          acts: tree.acts.map((act) => ({
            ...act,
            nodes: act.nodes.map((node) => {
              if (node.id !== nodeId) return node;
              if (node.choices.length >= 3) return node;
              return { ...node, choices: [...node.choices, choice] };
            }),
          })),
        };
      });
      saveToStorage('horror-trees', trees);
      return { trees };
    });
  },

  updateChoice: (treeId, nodeId, choiceId, updates) => {
    set((state) => {
      const trees = state.trees.map((tree) => {
        if (tree.id !== treeId) return tree;
        return {
          ...tree,
          acts: tree.acts.map((act) => ({
            ...act,
            nodes: act.nodes.map((node) => {
              if (node.id !== nodeId) return node;
              return {
                ...node,
                choices: node.choices.map((c) => (c.id === choiceId ? { ...c, ...updates } : c)),
              };
            }),
          })),
        };
      });
      saveToStorage('horror-trees', trees);
      return { trees };
    });
  },

  removeChoice: (treeId, nodeId, choiceId) => {
    set((state) => {
      const trees = state.trees.map((tree) => {
        if (tree.id !== treeId) return tree;
        return {
          ...tree,
          acts: tree.acts.map((act) => ({
            ...act,
            nodes: act.nodes.map((node) => {
              if (node.id !== nodeId) return node;
              return { ...node, choices: node.choices.filter((c) => c.id !== choiceId) };
            }),
          })),
        };
      });
      saveToStorage('horror-trees', trees);
      return { trees };
    });
  },

  addFeedback: (feedback) => {
    set((state) => {
      const feedbacks = [...state.feedbacks, feedback];
      saveToStorage('horror-feedbacks', feedbacks);
      return { feedbacks };
    });
  },

  addFearMark: (treeId, mark) => {
    set((state) => {
      const feedbacks = state.feedbacks.map((fb) => {
        if (fb.treeId !== treeId) return fb;
        return { ...fb, marks: [...fb.marks, mark] };
      });
      saveToStorage('horror-feedbacks', feedbacks);
      return { feedbacks };
    });
  },

  getFeedbacksByTreeId: (treeId) => {
    return get().feedbacks.filter((fb) => fb.treeId === treeId);
  },

  importFeedback: (feedback, treeSnapshot) => {
    if (treeSnapshot) {
      const existingTree = get().trees.find((t) => t.id === treeSnapshot.id);
      if (!existingTree) {
        get().importTreeSnapshot(treeSnapshot);
      }
    }
    set((state) => {
      const feedbacks = [...state.feedbacks, feedback];
      saveToStorage('horror-feedbacks', feedbacks);
      return { feedbacks };
    });
  },

  importTreeSnapshot: (snapshot) => {
    set((state) => {
      const existingIndex = state.trees.findIndex((t) => t.id === snapshot.id);
      const recoveredCopy = { ...state.recoveredSnapshots };
      recoveredCopy[snapshot.id] = snapshot;
      saveToStorage('horror-recovered-snapshots', recoveredCopy);
      let trees;
      if (existingIndex >= 0) {
        trees = [...state.trees];
        trees[existingIndex] = snapshot;
      } else {
        trees = [...state.trees, snapshot];
      }
      saveToStorage('horror-trees', trees);
      return { trees, recoveredSnapshots: recoveredCopy };
    });
  },

  createBatch: (topicId, name, description = '', deadline = null) => {
    const batch: AssignmentBatch = {
      id: generateId(),
      topicId,
      name,
      deadline,
      description,
      createdAt: Date.now(),
      assignedTreeIds: [],
    };
    set((state) => {
      const batches = [...state.batches, batch];
      saveToStorage('horror-batches', batches);
      return { batches };
    });
    return batch;
  },

  updateBatch: (id, updates) => {
    set((state) => {
      const batches = state.batches.map((b) => (b.id === id ? { ...b, ...updates } : b));
      saveToStorage('horror-batches', batches);
      return { batches };
    });
  },

  removeBatch: (id) => {
    set((state) => {
      const batches = state.batches.filter((b) => b.id !== id);
      saveToStorage('horror-batches', batches);
      return { batches };
    });
  },

  getBatchesByTopicId: (topicId) => {
    return get().batches.filter((b) => b.topicId === topicId);
  },

  assignTreeToBatch: (batchId, treeId) => {
    set((state) => {
      const batches = state.batches.map((b) => {
        if (b.id !== batchId) return b;
        if (b.assignedTreeIds.includes(treeId)) return b;
        return { ...b, assignedTreeIds: [...b.assignedTreeIds, treeId] };
      });
      saveToStorage('horror-batches', batches);
      return { batches };
    });
  },

  unassignTreeFromBatch: (batchId, treeId) => {
    set((state) => {
      const batches = state.batches.map((b) => {
        if (b.id !== batchId) return b;
        return { ...b, assignedTreeIds: b.assignedTreeIds.filter((id) => id !== treeId) };
      });
      saveToStorage('horror-batches', batches);
      return { batches };
    });
  },

  isFeedbackDuplicate: (feedback, existingFbs) => {
    const pool = existingFbs || get().feedbacks;
    return pool.some((fb) => {
      if (fb.treeId !== feedback.treeId) return false;
      if (fb.playedAt === feedback.playedAt) return true;
      const a = fb.marks.map((m) => m.nodeId).sort().join(',');
      const b = feedback.marks.map((m) => m.nodeId).sort().join(',');
      return a === b && a.length > 0;
    });
  },

  importFeedbackCode: (rawCode) => {
    const code = rawCode.trim();
    const decoded = decodeFeedbackCode(code);
    if (!decoded) {
      return { code, status: 'failed', message: '反馈码无效' };
    }
    const feedback: PlaybackFeedback = {
      treeId: decoded.treeId,
      marks: decoded.marks,
      playedAt: decoded.playedAt,
      reviewerName: decoded.reviewerName || undefined,
    };
    const isDup = get().isFeedbackDuplicate(feedback);
    if (isDup) {
      if (decoded.treeSnapshot && !get().trees.find((t) => t.id === decoded.treeSnapshot!.id)) {
        get().importTreeSnapshot(decoded.treeSnapshot);
      }
      return { code, status: 'skipped', message: '重复反馈已跳过' };
    }
    get().importFeedback(feedback, decoded.treeSnapshot || null);
    const byTree = get().getFeedbacksByTreeId(decoded.treeId);
    const reviewer = decoded.reviewerName || '匿名';
    const ordinal = byTree.length === 1 ? '首份反馈' : `第 ${byTree.length} 份反馈`;
    return {
      code,
      status: 'added',
      message: `${reviewer}: ${ordinal}`,
    };
  },

  batchImportFeedbackCodes: (codesText) => {
    const raw = codesText
      .split(/[\r\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.startsWith('FB-'));
    const details: BatchImportResult['details'] = [];
    let added = 0, skipped = 0, failed = 0, recovered = 0;
    const prevRecoveredBefore = Object.keys(get().recoveredSnapshots).length;
    for (const code of raw) {
      const result = get().importFeedbackCode(code);
      details.push(result);
      if (result.status === 'added') added++;
      else if (result.status === 'skipped') skipped++;
      else failed++;
    }
    const prevRecoveredAfter = Object.keys(get().recoveredSnapshots).length;
    recovered = prevRecoveredAfter - prevRecoveredBefore;
    return { added, skipped, failed, recoveredTrees: recovered, details };
  },
}));
