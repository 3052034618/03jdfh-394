import type { HintItem, DialogueTree, ActType, DialogueNode } from '@/types';
import { HORROR_WORDS, EXPLANATION_WORDS } from '@/utils';

export function analyzeDialogueTree(tree: DialogueTree): HintItem[] {
  const hints: HintItem[] = [];

  hints.push(...checkRepeatHorrorWords(tree));
  hints.push(...checkNpcOverexplain(tree));
  hints.push(...checkMissingEmotionConsequence(tree));
  hints.push(...checkEmptyActs(tree));
  hints.push(...checkBrokenLinks(tree));
  hints.push(...checkUnreachableNodes(tree));
  hints.push(...checkDeadEndsInMiddle(tree));

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
      const label = act.type === 'opening' ? '开场寒暄' : act.type === 'anomaly' ? '异常暗示' : '认知崩塌';
      hints.push({
        id: `overexplain-ratio-${act.id}`,
        type: 'error',
        category: 'overexplain',
        message: `${label}阶段 NPC 话语占比超过 75%，玩家被动倾听——减少 NPC 输出，增加玩家主动性`,
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
          choiceId: choice.id,
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

function checkBrokenLinks(tree: DialogueTree): HintItem[] {
  const hints: HintItem[] = [];
  const allNodeIds = new Set(tree.acts.flatMap((a) => a.nodes.map((n) => n.id)));
  const nodeMap: Record<string, DialogueNode> = {};
  for (const act of tree.acts) {
    for (const node of act.nodes) {
      nodeMap[node.id] = node;
    }
  }

  for (const act of tree.acts) {
    for (const node of act.nodes) {
      if (node.choices.length === 0) continue;

      for (const choice of node.choices) {
        if (!choice.nextNodeId) {
          hints.push({
            id: `broken-choice-${choice.id}`,
            type: 'error',
            category: 'structure',
            message: `选项"${choice.text.slice(0, 15)}${choice.text.length > 15 ? '…' : ''}"未连接到下一段对白，回放会在此断掉`,
            actId: act.id,
            nodeId: node.id,
            choiceId: choice.id,
          });
        } else if (!allNodeIds.has(choice.nextNodeId)) {
          hints.push({
            id: `broken-target-${choice.id}`,
            type: 'error',
            category: 'structure',
            message: `选项"${choice.text.slice(0, 15)}${choice.text.length > 15 ? '…' : ''}"指向的对白已被删除，成为死链`,
            actId: act.id,
            nodeId: node.id,
            choiceId: choice.id,
          });
        }
      }
    }
  }

  return hints;
}

function checkUnreachableNodes(tree: DialogueTree): HintItem[] {
  const hints: HintItem[] = [];
  const allNodeIds = tree.acts.flatMap((a) => a.nodes.map((n) => n.id));
  if (allNodeIds.length === 0) return hints;

  const targetIds = new Set<string>();
  for (const act of tree.acts) {
    for (const node of act.nodes) {
      for (const choice of node.choices) {
        if (choice.nextNodeId) {
          targetIds.add(choice.nextNodeId);
        }
      }
    }
  }

  const sortedActs = [...tree.acts].sort((a, b) => a.order - b.order);
  const firstActFirstNode = sortedActs[0]?.nodes[0]?.id;

  const reachable = new Set<string>();
  const queue: string[] = [];
  if (firstActFirstNode) {
    queue.push(firstActFirstNode);
    reachable.add(firstActFirstNode);
  }

  const nodeMap: Record<string, DialogueNode> = {};
  const actOfNode: Record<string, ActType> = {};
  const nextInOrder: Record<string, string | null> = {};

  for (const act of sortedActs) {
    for (let i = 0; i < act.nodes.length; i++) {
      const node = act.nodes[i];
      nodeMap[node.id] = node;
      actOfNode[node.id] = act.type;

      if (i < act.nodes.length - 1) {
        nextInOrder[node.id] = act.nodes[i + 1].id;
      } else {
        const nextAct = sortedActs[act.order + 1];
        nextInOrder[node.id] = nextAct?.nodes[0]?.id || null;
      }
    }
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = nodeMap[nodeId];
    if (!node) continue;

    const hasExplicitBranch = node.choices.some((c) => c.nextNodeId);
    const hasAnyChoice = node.choices.length > 0;

    if (hasAnyChoice) {
      for (const choice of node.choices) {
        if (choice.nextNodeId && !reachable.has(choice.nextNodeId)) {
          reachable.add(choice.nextNodeId);
          queue.push(choice.nextNodeId);
        }
      }
    }

    if (!hasExplicitBranch) {
      const fallback = nextInOrder[nodeId];
      if (fallback && !reachable.has(fallback)) {
        reachable.add(fallback);
        queue.push(fallback);
      }
    }
  }

  const actLabelMap: Record<ActType, string> = {
    opening: '开场寒暄',
    anomaly: '异常暗示',
    collapse: '认知崩塌',
  };

  for (const nodeId of allNodeIds) {
    if (!reachable.has(nodeId)) {
      const node = nodeMap[nodeId];
      const actType = actOfNode[nodeId];
      hints.push({
        id: `unreachable-${nodeId}`,
        type: 'warning',
        category: 'structure',
        message: `${actLabelMap[actType]}阶段存在不可到达的对白："${(node?.content || '').slice(0, 20)}${(node?.content || '').length > 20 ? '…' : ''}"`,
        nodeId,
      });
    }
  }

  return hints;
}

function checkDeadEndsInMiddle(tree: DialogueTree): HintItem[] {
  const hints: HintItem[] = [];
  const sortedActs = [...tree.acts].sort((a, b) => a.order - b.order);
  if (sortedActs.length === 0) return hints;

  const nodeMap: Record<string, DialogueNode> = {};
  const actOfNode: Record<string, ActType> = {};
  const nodeIndexInAct: Record<string, number> = {};

  for (const act of sortedActs) {
    for (let i = 0; i < act.nodes.length; i++) {
      nodeMap[act.nodes[i].id] = act.nodes[i];
      actOfNode[act.nodes[i].id] = act.type;
      nodeIndexInAct[act.nodes[i].id] = i;
    }
  }

  const totalNodes = sortedActs.reduce((s, a) => s + a.nodes.length, 0);

  for (const act of sortedActs) {
    for (const node of act.nodes) {
      if (node.choices.length === 0) continue;

      const allChoicesLeadToNodes = node.choices.every((c) => c.nextNodeId != null);

      for (const choice of node.choices) {
        if (!choice.nextNodeId) continue;
        const target = nodeMap[choice.nextNodeId];
        if (!target) continue;

        const targetActType = actOfNode[target.id];
        const targetIdx = nodeIndexInAct[target.id];

        if (targetActType === act.type && targetIdx <= nodeIndexInAct[node.id] + 1) {
          continue;
        }
        if (targetActType !== act.type) {
          continue;
        }
      }

      const isLastNodeOfLastAct =
        act.type === 'collapse' && nodeIndexInAct[node.id] === act.nodes.length - 1;

      if (allChoicesLeadToNodes && !isLastNodeOfLastAct) {
        const hasForwardJump = node.choices.some((c) => {
          if (!c.nextNodeId) return false;
          const target = nodeMap[c.nextNodeId];
          if (!target) return false;
          const targetAct = actOfNode[target.id];
          if (targetAct !== act.type) return true;
          return nodeIndexInAct[target.id] > nodeIndexInAct[node.id];
        });
        const allJumpBack = node.choices.every((c) => {
          if (!c.nextNodeId) return false;
          const target = nodeMap[c.nextNodeId];
          if (!target) return false;
          const targetAct = actOfNode[target.id];
          if (targetAct !== act.type) return false;
          return nodeIndexInAct[target.id] <= nodeIndexInAct[node.id];
        });
        if (allJumpBack && totalNodes > nodeIndexInAct[node.id] + 1 + 5) {
          hints.push({
            id: `deadend-loop-${node.id}`,
            type: 'warning',
            category: 'structure',
            message: `该节点的所有选项都指向了更早的对白，可能形成死循环——考虑让至少一条分支能推进剧情`,
            nodeId: node.id,
            actId: act.id,
          });
        }
      }
    }
  }

  return hints;
}
