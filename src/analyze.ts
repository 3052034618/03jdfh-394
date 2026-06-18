import type { HintItem, DialogueTree, ActType } from '@/types';
import { HORROR_WORDS, EXPLANATION_WORDS } from '@/utils';

export function analyzeDialogueTree(tree: DialogueTree): HintItem[] {
  const hints: HintItem[] = [];

  hints.push(...checkRepeatHorrorWords(tree));
  hints.push(...checkNpcOverexplain(tree));
  hints.push(...checkMissingEmotionConsequence(tree));
  hints.push(...checkEmptyActs(tree));

  return hints;
}

function checkRepeatHorrorWords(tree: DialogueTree): HintItem[] {
  const hints: HintItem[] = [];
  const wordCounts: Record<string, number> = {};

  for (const act of tree.acts) {
    for (const node of act.nodes) {
      if (node.speaker !== 'npc') continue;
      for (const word of HORROR_WORDS) {
        const regex = new RegExp(word, 'g');
        const matches = node.content.match(regex);
        if (matches) {
          wordCounts[word] = (wordCounts[word] || 0) + matches.length;
        }
      }
    }
  }

  for (const [word, count] of Object.entries(wordCounts)) {
    if (count >= 3) {
      hints.push({
        id: `repeat-${word}`,
        type: 'error',
        category: 'repeat',
        message: `"${word}" 已出现 ${count} 次，重复使用会削弱恐惧效果`,
      });
    } else if (count === 2) {
      hints.push({
        id: `repeat-warn-${word}`,
        type: 'warning',
        category: 'repeat',
        message: `"${word}" 已出现 2 次，注意避免再重复`,
      });
    }
  }

  return hints;
}

function checkNpcOverexplain(tree: DialogueTree): HintItem[] {
  const hints: HintItem[] = [];

  for (const act of tree.acts) {
    const npcNodes = act.nodes.filter((n) => n.speaker === 'npc');
    const totalNodes = act.nodes.length;

    for (const node of npcNodes) {
      if (node.content.length > 150) {
        hints.push({
          id: `overexplain-len-${node.id}`,
          type: 'warning',
          category: 'overexplain',
          message: `NPC 台词超过 150 字（${node.content.length} 字），考虑精简——恐怖留白比解释更有效`,
          actId: act.id,
          nodeId: node.id,
        });
      }

      for (const expWord of EXPLANATION_WORDS) {
        if (node.content.includes(expWord)) {
          hints.push({
            id: `overexplain-word-${node.id}-${expWord}`,
            type: 'warning',
            category: 'overexplain',
            message: `NPC 使用了"${expWord}"——过度解释会破坏玩家的想象空间`,
            actId: act.id,
            nodeId: node.id,
          });
          break;
        }
      }
    }

    if (totalNodes > 0 && npcNodes.length / totalNodes > 0.75) {
      hints.push({
        id: `overexplain-ratio-${act.id}`,
        type: 'error',
        category: 'overexplain',
        message: `${act.type === 'opening' ? '开场寒暄' : act.type === 'anomaly' ? '异常暗示' : '认知崩塌'}阶段 NPC 话语占比超过 75%，玩家被动倾听——减少 NPC 输出，增加玩家主动性`,
        actId: act.id,
      });
    }
  }

  return hints;
}

function checkMissingEmotionConsequence(tree: DialogueTree): HintItem[] {
  const hints: HintItem[] = [];

  const actLabelMap: Record<ActType, string> = {
    opening: '开场寒暄',
    anomaly: '异常暗示',
    collapse: '认知崩塌',
  };

  for (const act of tree.acts) {
    const allChoices = act.nodes.flatMap((n) => n.choices);
    const missingConsequences = allChoices.filter((c) => !c.emotionConsequence.trim());

    if (act.nodes.length > 0 && allChoices.length > 0 && missingConsequences.length === allChoices.length) {
      hints.push({
        id: `emotion-all-${act.id}`,
        type: 'error',
        category: 'emotion',
        message: `${actLabelMap[act.type]}阶段所有选项均无情绪后果，恐怖感断裂——每个选择都应有情感代价`,
        actId: act.id,
      });
    } else if (missingConsequences.length > 0) {
      for (const choice of missingConsequences) {
        hints.push({
          id: `emotion-missing-${choice.id}`,
          type: 'warning',
          category: 'emotion',
          message: `选项"${choice.text.slice(0, 15)}${choice.text.length > 15 ? '…' : ''}"缺少情绪后果`,
          actId: act.id,
        });
      }
    }
  }

  return hints;
}

function checkEmptyActs(tree: DialogueTree): HintItem[] {
  const hints: HintItem[] = [];

  const actLabelMap: Record<ActType, string> = {
    opening: '开场寒暄',
    anomaly: '异常暗示',
    collapse: '认知崩塌',
  };

  for (const act of tree.acts) {
    if (act.nodes.length === 0) {
      hints.push({
        id: `empty-act-${act.id}`,
        type: 'warning',
        category: 'structure',
        message: `${actLabelMap[act.type]}阶段还没有对白`,
        actId: act.id,
      });
    }
  }

  return hints;
}
