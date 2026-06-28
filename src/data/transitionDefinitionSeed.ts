export type TransitionDefinitionOperator = {
  id: string;
  name: string;
  expression: string;
  leftTerm: string;
  relation: 'OF';
  rightTerm: string;
  description: string;
  softwareMeaning: string;
};

export const transitionDefinitionSeed: TransitionDefinitionOperator[] = [
  {
    id: 'TD-0001',
    name: 'State OF Transition',
    expression: 'State OF Transition',
    leftTerm: 'State',
    relation: 'OF',
    rightTerm: 'Transition',
    description: 'The state produced by a transition.',
    softwareMeaning: 'Resolve the output state after an allowed transition is applied.',
  },
  {
    id: 'TD-0002',
    name: 'Transition OF State',
    expression: 'Transition OF State',
    leftTerm: 'Transition',
    relation: 'OF',
    rightTerm: 'State',
    description: 'The transition available to a current state.',
    softwareMeaning: 'List or execute permitted next status changes for an object.',
  },
  {
    id: 'TD-0003',
    name: 'Definition OF Transition',
    expression: 'Definition OF Transition',
    leftTerm: 'Definition',
    relation: 'OF',
    rightTerm: 'Transition',
    description: 'The rule that gives a transition meaning.',
    softwareMeaning: 'Validate a state change against its transition definition before mutation.',
  },
  {
    id: 'TD-0004',
    name: 'Transition OF Definitions',
    expression: 'Transition OF Definitions',
    leftTerm: 'Transition',
    relation: 'OF',
    rightTerm: 'Definitions',
    description: 'The evolution of definitions while preserving parent identity.',
    softwareMeaning: 'Supersede or refine a definition without losing its lineage.',
  },
  {
    id: 'TD-0005',
    name: 'Definition OF State',
    expression: 'Definition OF State',
    leftTerm: 'Definition',
    relation: 'OF',
    rightTerm: 'State',
    description: 'The controlled meaning of a state.',
    softwareMeaning: 'Bind statuses such as queued, in_progress, completed, or blocked to exact completion rules.',
  },
  {
    id: 'TD-0006',
    name: 'State OF Definitions',
    expression: 'State OF Definitions',
    leftTerm: 'State',
    relation: 'OF',
    rightTerm: 'Definitions',
    description: 'The maturity and evidence status of a definition set.',
    softwareMeaning: 'Report whether definitions are asserted, documented, structured, implemented, tested, or reproduced.',
  },
];

export function findTransitionDefinition(id: string): TransitionDefinitionOperator | undefined {
  return transitionDefinitionSeed.find((operator) => operator.id === id);
}

export function listTransitionDefinitionsByTerm(term: string): TransitionDefinitionOperator[] {
  const normalized = term.toLowerCase();
  return transitionDefinitionSeed.filter(
    (operator) =>
      operator.leftTerm.toLowerCase() === normalized ||
      operator.rightTerm.toLowerCase() === normalized,
  );
}
