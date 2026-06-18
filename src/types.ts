export type ActType = 'opening' | 'anomaly' | 'collapse';

export interface PlayerChoice {
  id: string;
  text: string;
  emotionConsequence: string;
  nextNodeId: string | null;
}

export interface DialogueNode {
  id: string;
  actId: string;
  speaker: 'npc' | 'narrator';
  content: string;
  emotionTag: string;
  choices: PlayerChoice[];
}

export interface Act {
  id: string;
  type: ActType;
  order: number;
  nodes: DialogueNode[];
}

export interface DialogueTree {
  id: string;
  topicId: string;
  authorName: string;
  acts: Act[];
  createdAt: number;
}

export interface Topic {
  id: string;
  title: string;
  scenario: string;
  constraints: string[];
}

export interface FearMark {
  id: string;
  nodeId: string;
  timestamp: number;
}

export interface PlaybackFeedback {
  treeId: string;
  marks: FearMark[];
  playedAt: number;
}

export interface HintItem {
  id: string;
  type: 'error' | 'warning' | 'success';
  category: 'repeat' | 'overexplain' | 'emotion' | 'structure';
  message: string;
  actId?: string;
  nodeId?: string;
}

export type PlaybackMode = 'chat' | 'subtitle';

export const ACT_LABELS: Record<ActType, string> = {
  opening: '开场寒暄',
  anomaly: '异常暗示',
  collapse: '认知崩塌',
};

export const ACT_DESCRIPTIONS: Record<ActType, string> = {
  opening: '建立日常氛围，让玩家放松警惕',
  anomaly: '植入微妙违和感，逐步累积不安',
  collapse: '揭示恐怖真相，玩家认知彻底崩塌',
};

export const SAMPLE_TOPICS: Topic[] = [
  {
    id: 'sample-1',
    title: '深夜来电',
    scenario: '主角独自在公寓接到母亲来电，但母亲已在三个月前去世。电话那头的声音和生前一模一样。',
    constraints: ['不能出现怪物或鬼魂的视觉描写', '只能靠对话制造不安', '母亲的声音必须始终保持温柔'],
  },
  {
    id: 'sample-2',
    title: '回声室友',
    scenario: '主角和室友合租，某天起室友开始重复主角昨天说过的话，但室友坚称自己没说过那些话。',
    constraints: ['不能使用超自然设定', '只能通过日常对话推进', '室友必须始终表现得很正常'],
  },
  {
    id: 'sample-3',
    title: '育儿热线',
    scenario: '新手妈妈拨打24小时育儿热线求助，接线员给出的建议越来越怪异，但态度始终专业而温和。',
    constraints: ['不能让接线员表现出恶意', '所有建议表面听上去都必须合理', '恐怖感只能通过逐渐升级的荒诞来制造'],
  },
  {
    id: 'sample-4',
    title: '旧照片',
    scenario: '主角整理亡父遗物时发现一张合影，照片里有个人主角不认识，但父亲在日记里反复提到这个人。',
    constraints: ['不能使用跳跃式惊吓', '只能通过对话和独白推进', '照片中的陌生人身份必须到最后才揭示'],
  },
  {
    id: 'sample-5',
    title: '最后的患者',
    scenario: '心理咨询师接到一个新患者，患者描述的症状和咨询师自己完全一致，但患者声称从未见过咨询师。',
    constraints: ['不能出现超自然元素', '患者和咨询师的对话必须对等', '咨询师的专业素养必须逐步瓦解'],
  },
];
