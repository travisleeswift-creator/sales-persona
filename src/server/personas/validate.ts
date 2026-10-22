import { OBJECTION_CATEGORIES, type PersonaDefinition } from "@/lib/domain";

function longEnough(value: string, minimum = 20): boolean {
  return value.trim().length >= minimum;
}

export function validatePersona(persona: PersonaDefinition): string[] {
  const errors: string[] = [];
  const fail = (message: string) => errors.push(message);
  if (persona.slug !== persona.id) fail("slug must match id");
  if (!longEnough(persona.summary, 40)) fail("summary is too short");
  if (!longEnough(persona.offerContext, 40)) fail("offer context is too short");
  if (persona.monogram.trim().length < 2) fail("monogram is missing");

  const tone = persona.toneProfile;
  for (const key of ["formality", "skepticism", "warmth", "directness"] as const) {
    if (tone[key] < 1 || tone[key] > 5) fail(`${key} must be 1-5`);
  }
  if (tone.samplePhrases.length < 3) fail("need 3 sample phrases");
  if (tone.vocabulary.length < 4) fail("need 4 vocabulary words");
  if (tone.avoid.length < 2) fail("need 2 avoid notes");
  if (!longEnough(tone.voiceSummary, 40)) fail("voice summary is too short");

  if (persona.objectionPatterns.length !== OBJECTION_CATEGORIES.length) fail("need one objection per category");
  const categories = new Set(persona.objectionPatterns.map((objection) => objection.category));
  if (categories.size !== OBJECTION_CATEGORIES.length) fail("objection categories are not complete");
  const ids = new Set<string>();
  const painIds = new Set(persona.painPoints.map((pain) => pain.id));
  for (const objection of persona.objectionPatterns) {
    if (ids.has(objection.id)) fail(`duplicate objection ${objection.id}`);
    ids.add(objection.id);
    if (!objection.id.startsWith(`${persona.id}-`)) fail(`objection id ${objection.id} is not namespaced`);
    if (!painIds.has(objection.painPointId)) fail(`${objection.id} points at a missing pain`);
    if (objection.keywords.length < 3) fail(`${objection.id} needs keywords`);
    for (const field of ["text", "escalationText", "probeText", "softenText"] as const) {
      if (!longEnough(objection[field], 40)) fail(`${objection.id} ${field} is too short`);
    }
  }
  const intensityOne = persona.objectionPatterns.filter((objection) => objection.intensity === 1).length;
  const intensityHigh = persona.objectionPatterns.filter((objection) => objection.intensity >= 2).length;
  const intensityThree = persona.objectionPatterns.filter((objection) => objection.intensity === 3).length;
  if (intensityOne < 3) fail("need 3 intensity-1 objections");
  if (intensityHigh < 4) fail("need 4 objections at intensity 2 or more");
  if (intensityThree < 2) fail("need 2 intensity-3 objections");

  if (persona.painPoints.length < 4) fail("need 4 pain points");
  for (const pain of persona.painPoints) {
    if (!longEnough(pain.detail, 30)) fail(`pain ${pain.id} is thin`);
    if (pain.keywords.length < 2) fail(`pain ${pain.id} needs keywords`);
  }
  if (persona.buyingTriggers.length < 4) fail("need 4 buying triggers");
  for (const trigger of persona.buyingTriggers) {
    if (!longEnough(trigger.detail, 30)) fail(`trigger ${trigger.id} is thin`);
    if (trigger.phrases.length < 2) fail(`trigger ${trigger.id} needs phrases`);
  }
  if (persona.closingSignals.length < 3) fail("need 3 closing signals");
  for (const signal of persona.closingSignals) {
    if (!longEnough(signal.phrase, 20)) fail(`signal ${signal.id} phrase is short`);
  }

  const { easy, medium, hard } = persona.difficultyScaling;
  if (!(easy.advanceScore < medium.advanceScore && medium.advanceScore < hard.advanceScore)) {
    fail("advance scores must rise with difficulty");
  }
  if (!(easy.escalateBelow < medium.escalateBelow && medium.escalateBelow < hard.escalateBelow)) {
    fail("escalation floors must rise with difficulty");
  }
  if (!(easy.intensityCeiling <= medium.intensityCeiling && medium.intensityCeiling <= hard.intensityCeiling)) {
    fail("intensity ceilings must rise with difficulty");
  }
  if (easy.stacksConcerns || medium.stacksConcerns || !hard.stacksConcerns) fail("only hard mode stacks concerns");
  if (easy.maxTurns >= medium.maxTurns || medium.maxTurns >= hard.maxTurns) fail("max turns must rise");
  for (const [name, band] of [
    ["easy", easy],
    ["medium", medium],
    ["hard", hard],
  ] as const) {
    if (!longEnough(band.coachingNote, 40)) fail(`${name} coaching note is thin`);
    if (band.escalateBelow >= band.advanceScore) fail(`${name} thresholds overlap`);
  }

  const style = persona.conversationStyle;
  if (!longEnough(style.summary, 40)) fail("conversation summary is thin");
  if (!longEnough(style.greeting, 30)) fail("greeting is thin");
  for (const field of ["wonLine", "lostLine", "partialLine", "hesitateLine"] as const) {
    if (!longEnough(style[field], 20)) fail(`${field} is thin`);
  }
  for (const field of ["probeLead", "escalateLead", "softenLead", "nextLead", "closingLead"] as const) {
    if (style[field].length < 2) fail(`${field} needs two lines`);
  }
  if (style.respects.length < 2 || style.irritants.length < 2) fail("respects and irritants are thin");
  if (style.interruptLine && (style.interruptAfterWords < 40 || style.interruptAfterWords > 140)) {
    fail("interrupt threshold is out of range");
  }
  return errors;
}
