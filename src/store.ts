import { create } from 'zustand';
import type { Topic, DialogueTree, DialogueNode, Act, PlayerChoice, PlaybackFeedback, FearMark } from '@/types';
import { ActType } from '@/types';
import { generateId } from '@/utils';

interface AppState {
  topics: Topic[];
  trees: DialogueTree[];
  feedbacks: PlaybackFeedback[];

  addTopic: (topic: Topic) => void;
  updateTopic: (id: string, updates: Partial<Topic>) => void;
  removeTopic: (id: string) => void;

  createTree: (topicId: string, authorName: string) => DialogueTree;
  updateTree: (id: string, updates: Partial<DialogueTree>) => void;
  removeTree: (id: string) => void;
  getTreeById: (id: string) => DialogueTree | undefined;
  getTreeByTopicId: (topicId: string) => DialogueTree | undefined;

  addNode: (treeId: string, actId: string, node: DialogueNode) => void;
  updateNode: (treeId: string, nodeId: string, updates: Partial<DialogueNode>) => void;
  removeNode: (treeId: string, actId: string, nodeId: string) => void;

  addChoice: (treeId: string, nodeId: string, choice: PlayerChoice) => void;
  updateChoice: (treeId: string, nodeId: string, choiceId: string, updates: Partial<PlayerChoice>) => void;
  removeChoice: (treeId: string, nodeId: string, choiceId: string) => void;

  addFeedback: (feedback: PlaybackFeedback) => void;
  addFearMark: (treeId: string, mark: FearMark) => void;
  getFeedbacksByTreeId: (treeId: string) => PlaybackFeedback[];
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
}));
