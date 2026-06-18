import type { FeedbackCode, DialogueTree, PlaybackFeedback } from '@/types';

export const HORROR_WORDS = [
  '鬼', '死', '血', '影子', '哭声', '黑暗', '腐烂', '尸体', '坟', '墓',
  '棺', '骨', '灵', '魂', '诅咒', '怨', '恨', '杀', '害', '怕',
  '寒', '冷', '颤', '抖', '尖叫', '惨', '痛', '裂', '碎', '坠',
  '深渊', '吞噬', '扭曲', '变形', '异变', '诡异', '恐怖', '阴', '森', '冷笑',
  '诡异', '不对劲', '不正常', '看不见', '消失', '回来', '回来了', '不该', '不要',
  '别回头', '背后', '身后', '角落', '黑暗中', '凝视', '注视', '盯着', '窥视',
  '低语', '呢喃', '呼唤', '名字', '谁', '谁在', '有人在', '不是人', '不是真的',
  '假的', '伪装', '冒充', '代替', '取代', '一模一样', '复制', '镜像', '倒影',
  '重复', '循环', '永恒', '无尽', '逃不掉', '逃不出去', '出不去', '被困', '锁',
  '门', '开不了', '打不开', '关上', '关不住', '声音', '脚步', '呼吸', '气息',
];

export const EXPLANATION_WORDS = [
  '因为', '所以', '其实是', '原因是', '之所以', '是因为', '由于',
  '因此', '导致', '结果', '意味着', '这说明', '也就是说',
  '换句话说', '简单来说', '总而言之', '归根结底', '本质上',
  '事实上', '实际上', '真相是', '事实是', '原因是这样的',
];

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export function encodeTreeToUrl(tree: Record<string, unknown>): string {
  try {
    const json = JSON.stringify(tree);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    return encoded;
  } catch {
    return '';
  }
}

export function decodeTreeFromUrl(encoded: string): Record<string, unknown> | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function encodeFeedbackCode(feedback: FeedbackCode): string {
  try {
    const json = JSON.stringify(feedback);
    const base64 = btoa(unescape(encodeURIComponent(json)));
    return `FB-${base64}`;
  } catch {
    return '';
  }
}

export function decodeFeedbackCode(code: string): FeedbackCode | null {
  try {
    if (!code.startsWith('FB-')) return null;
    const base64 = code.slice(3);
    const json = decodeURIComponent(escape(atob(base64)));
    const parsed = JSON.parse(json);
    if (parsed.version && parsed.treeId && Array.isArray(parsed.marks)) {
      return parsed as FeedbackCode;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildFeedbackCode(
  tree: DialogueTree,
  feedback: PlaybackFeedback,
  reviewerName: string = '',
): FeedbackCode {
  const nodeTextMap: Record<string, string> = {};
  for (const act of tree.acts) {
    for (const node of act.nodes) {
      nodeTextMap[node.id] = node.content;
    }
  }
  return {
    version: 1,
    treeId: tree.id,
    treeSnapshot: tree,
    marks: feedback.marks,
    playedAt: feedback.playedAt,
    reviewerName,
    nodeTextMap,
  };
}

