/**
 * task-conciseness — sample domain task A/B eval (pluggable template).
 *
 * Purpose: demonstrate the task-eval shape owners will use for their own
 * domain tasks. The ground-truth signal in the gate: adapter_score vs
 * base_score on the owner's task, same backend, with item counts.
 *
 * Owners define their own evals with this shape; the coordinator only
 * requires: known id (registered here or owner-registered), judge
 * exact|regex, and items >= the gate minimum to count as primary signal.
 */
export const taskConciseness = {
  id: 'task-conciseness',
  description: 'Sample task eval: answers should be concise (<= 25 words). Template for owner-defined task A/B evals.',
  kind: 'task',
  prompts: [
    { id: 'tc-01', prompt: 'In one short sentence, what is a database index?', judge: { type: 'regex', pattern: '^.{0,160}$' } },
    { id: 'tc-02', prompt: 'Briefly: why use version control?', judge: { type: 'regex', pattern: '^.{0,160}$' } },
    { id: 'tc-03', prompt: 'One sentence: what is an API?', judge: { type: 'regex', pattern: '^.{0,160}$' } },
    { id: 'tc-04', prompt: 'Briefly define recursion.', judge: { type: 'regex', pattern: '^.{0,160}$' } },
    { id: 'tc-05', prompt: 'One short sentence: what is caching for?', judge: { type: 'regex', pattern: '^.{0,160}$' } },
    { id: 'tc-06', prompt: 'Briefly: what does a compiler do?', judge: { type: 'regex', pattern: '^.{0,160}$' } },
    { id: 'tc-07', prompt: 'One sentence: what is encryption?', judge: { type: 'regex', pattern: '^.{0,160}$' } },
    { id: 'tc-08', prompt: 'Briefly define an operating system.', judge: { type: 'regex', pattern: '^.{0,160}$' } },
    { id: 'tc-09', prompt: 'One short sentence: what is a neural network?', judge: { type: 'regex', pattern: '^.{0,160}$' } },
    { id: 'tc-10', prompt: 'Briefly: why write tests?', judge: { type: 'regex', pattern: '^.{0,160}$' } },
  ],
};
