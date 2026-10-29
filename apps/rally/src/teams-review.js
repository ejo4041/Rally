import {AppError, applyDecision, confirmOutcome, createMeeting} from './core.js';
import {modelServices} from './model-services.js';
import {modelConfig} from './models.js';

// Saved-record work shares the live meeting lease, preventing concurrent edits
// and paid reviews. It never starts capture, joins a meeting or queues speech.
async function withRecord(repository, id, version, operation) {
  const lease = crypto.randomUUID();
  if (!await repository.lease(id, lease)) throw new AppError('This record is busy. Refresh and try again.', 409);
  try {
    const m = await repository.get(id);
    if (!m || m.kind !== 'teams' || m.phase !== 'ended') throw new AppError('Saved Teams record not found.', 404);
    if (!Number.isInteger(version) || version !== m.version) throw new AppError('This record changed. Refresh before continuing.', 409);
    return await operation(m);
  } finally {
    await repository.release(id, lease);
  }
}

export async function editTeamsRecord(repository, id, data) {
  return withRecord(repository, id, data.version, async m => {
    if (data.action === 'setup') {
      const setup = createMeeting({title:data.title, agenda:data.agenda, participants:data.participants,
        desiredOutcome:data.desiredOutcome, minutes:m.minutes, wrapMinutes:m.wrapMinutes});
      if (m.outcomes.some(o => o.status === 'confirmed' && o.owner && !setup.participants.includes(o.owner))) {
        throw new AppError('Keep the owners of confirmed outcomes in the participant roster.', 409);
      }
      for (const key of ['title','agenda','participants','desiredOutcome']) m[key] = setup[key];
      m.source.contextConfigured = true;
      // Drop obsolete identity corrections rather than silently naming absent people.
      for (const [key, name] of Object.entries(m.speakerNames)) if (!m.participants.includes(name)) {
        const changed = new Set(m.turns.filter(t => key === `turn:${t.id}` || key === t.speaker).map(t => t.id));
        for (const o of m.outcomes) if (o.status === 'confirmed' && o.evidence.some(e => changed.has(e.turnId))) o.status = 'disputed';
        delete m.speakerNames[key];
      }
      for (const o of m.outcomes) if (['proposed','disputed'].includes(o.status) && o.owner && !m.participants.includes(o.owner)) o.owner = null;
      m.currentAgenda = Math.min(m.currentAgenda, m.agenda.length - 1);
      if (m.review) m.review.stale = true;
    } else if (data.action === 'speaker') {
      const turn = m.turns.find(t => t.id === data.turnId);
      if (!turn || !m.participants.includes(data.name)) throw new AppError('Choose a transcript turn and a verified roster name.');
      m.speakerNames[`turn:${turn.id}`] = data.name;
      for (const o of m.outcomes) if (o.status === 'confirmed' && o.evidence.some(e => e.turnId === turn.id)) o.status = 'disputed';
      if (m.review) m.review.stale = true;
    } else if (data.action === 'reject') {
      const o = m.outcomes.find(o => o.id === data.id);
      if (!o || !['proposed','disputed'].includes(o.status)) throw new AppError('Choose an unresolved proposal.');
      o.status = 'rejected';
    } else if (data.action === 'confirm') {
      confirmOutcome(m, data.id, {owner:data.owner, dueDate:data.dueDate, actor:'Meeting host', note:'Explicit host confirmation on saved Teams record'});
    } else throw new AppError('Unknown saved-record operation.');
    m.epoch++;
    await repository.save(m);
    return {meeting:m};
  });
}

async function sourceKey(m,reasoning) {
  const bytes = new TextEncoder().encode(JSON.stringify({reasoning:{adapter:reasoning.adapter,model:reasoning.model,reasoningEffort:reasoning.reasoningEffort,maxOutputTokens:reasoning.maxOutputTokens},title:m.title, agenda:m.agenda, participants:m.participants,
    desiredOutcome:m.desiredOutcome, speakerNames:m.speakerNames, turns:m.turns}));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2,'0')).join('');
}

export async function reviewTeamsRecord(env, repository, id, data, services = {}) {
  if (data.consented !== true) throw new AppError('Confirm permission to send this saved transcript to Meta for review.');
  if (env.RALLY_PAID_ENABLED !== '1' || !env.MODEL_API_KEY) throw new AppError('Paid review is disabled in this environment.', 503);
  return withRecord(repository, id, data.version, async m => {
    if (!m.turns.length || m.turns.length > 200) throw new AppError('Review requires between 1 and 200 finalized turns.');
    if (!m.source.contextConfigured) throw new AppError('Save the meeting agenda and participant details before requesting review.');
    if (m.accountingWarning) throw new AppError('Reconcile this record’s accounting before further paid use.', 409);
    const reasoning=modelConfig(env).reasoning;
    const signature = await sourceKey(m,reasoning);
    if (m.review?.sourceKey === signature) {
      if(m.review.stale){m.review.stale=false;await repository.save(m);}
      return {meeting:m, cached:true};
    }
    const run = modelServices(env,services).moderate;
    try {
      const result = await run(env, structuredClone(m), repository, {review:true, reserveUsage:true});
      // Validate citations, roster and uncertainty through the same contract as
      // live moderation. Spoken text is never queued for a saved-record review.
      applyDecision(m, result.decision);
      m.review = {sourceKey:signature, at:new Date().toISOString(), model:result.usage.model||reasoning.model,
        turnCount:m.turns.filter(t => !t.echoRisk).length, stale:false, usageId:result.usage.id};
      await repository.save(m);
      return {meeting:m, cached:false};
    } catch (error) {
      if (error.accountingFailure) {
        m.accountingWarning = true;
        await repository.save(m);
      }
      throw error;
    }
  });
}
