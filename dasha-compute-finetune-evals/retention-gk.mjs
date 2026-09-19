/**
 * retention-gk — general-knowledge retention probes.
 *
 * Purpose: detect catastrophic forgetting / alignment tax after fine-tuning.
 * Generative (open-ended) by design: the model must PRODUCE the fact, not
 * pick it from options. Judges are exact-substring (normalized) or regex.
 *
 * Scoring: score = 100 * passed / judged. The gate compares base_score vs
 * adapter_score; tax = base − adapter. Tax > 15pp fails, > 8pp needs review.
 */
export const retentionGk = {
  id: 'retention-gk',
  description: 'General-knowledge retention probes (generative, open-ended). Guards against catastrophic forgetting.',
  kind: 'retention',
  prompts: [
    { id: 'gk-01', prompt: 'What is the capital of France?', judge: { type: 'exact', answers: ['paris'] } },
    { id: 'gk-02', prompt: 'What is 15 times 4?', judge: { type: 'exact', answers: ['60', 'sixty'] } },
    { id: 'gk-03', prompt: 'Who wrote the play Hamlet?', judge: { type: 'exact', answers: ['shakespeare', 'william shakespeare'] } },
    { id: 'gk-04', prompt: 'What planet is known as the Red Planet?', judge: { type: 'exact', answers: ['mars'] } },
    { id: 'gk-05', prompt: 'In one sentence, what does photosynthesis do?', judge: { type: 'regex', pattern: 'light.*(energy|glucose)|plants?.*(convert|make).*light|convert.*light.*(chemical|sugar|food)' } },
    { id: 'gk-06', prompt: 'What year did humans first land on the Moon?', judge: { type: 'exact', answers: ['1969'] } },
    { id: 'gk-07', prompt: 'What is the largest ocean on Earth?', judge: { type: 'exact', answers: ['pacific', 'pacific ocean'] } },
    { id: 'gk-08', prompt: 'Name the process by which water becomes vapor.', judge: { type: 'exact', answers: ['evaporation'] } },
    { id: 'gk-09', prompt: 'What gas do plants absorb from the atmosphere?', judge: { type: 'exact', answers: ['carbon dioxide', 'co2'] } },
    { id: 'gk-10', prompt: 'How many sides does a hexagon have?', judge: { type: 'exact', answers: ['6', 'six'] } },
    { id: 'gk-11', prompt: 'What is the boiling point of water at sea level in Celsius?', judge: { type: 'exact', answers: ['100', '100 degrees', '100°c'] } },
    { id: 'gk-12', prompt: 'Who painted the Mona Lisa?', judge: { type: 'exact', answers: ['leonardo da vinci', 'da vinci', 'leonardo'] } },
    { id: 'gk-13', prompt: 'What is the currency of Japan?', judge: { type: 'exact', answers: ['yen'] } },
    { id: 'gk-14', prompt: 'In one sentence, why is the sky blue?', judge: { type: 'regex', pattern: 'rayleigh|scatter.*(blue|light)|blue.*scatter' } },
    { id: 'gk-15', prompt: 'What force keeps planets in orbit around the Sun?', judge: { type: 'exact', answers: ['gravity', 'gravitational'] } },
    { id: 'gk-16', prompt: 'What is the chemical symbol for gold?', judge: { type: 'exact', answers: ['au'] } },
    { id: 'gk-17', prompt: 'How many days are in a leap year?', judge: { type: 'exact', answers: ['366'] } },
    { id: 'gk-18', prompt: 'What continent is the Sahara Desert on?', judge: { type: 'exact', answers: ['africa'] } },
    { id: 'gk-19', prompt: 'In one sentence, what is an atom made of?', judge: { type: 'regex', pattern: 'proton.*neutron.*electron|electron.*proton.*neutron|nucleus.*electron' } },
    { id: 'gk-20', prompt: 'What language is primarily spoken in Brazil?', judge: { type: 'exact', answers: ['portuguese'] } },
  ],
};
