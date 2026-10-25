// Controlli sulla logica di index.html che non si vede a occhio: import da Azure DevOps, ore scoperte,
// unione del file in caso di conflitto, migrazioni, sprint da DevOps. Niente rete: le chiamate sono simulate.
// Uso: node checks.mjs   (esce con errore al primo controllo che fallisce)
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const src = html.split('<script>')[1].split('</script>')[0];

// DOM finto: basta che gli accessi della pagina al caricamento non esplodano
const stub = () => new Proxy(function () {}, {
  get: (t, k) => k === 'classList' ? {toggle() {}, add() {}, remove() {}} : k === 'querySelectorAll' ? () => [] : stub(),
  set: () => true, apply: () => stub(),
});
Object.assign(globalThis, {document: stub(), window: stub(), indexedDB: {open: stub}, localStorage: {getItem: () => null, setItem() {}},
  setInterval: () => 0}); // i timer della pagina terrebbero vivo il processo all'infinito

let T;
(function () {
  eval(src + `;T = {imports, unlogged, merge, migrated, adoSprints, iterHours, syncSince, today, addDays, reindex, ghStore, b64enc, b64dec,
    setStore: (s, v, b) => { store = s; ver = v; base = b; }, flush, get data() { return data; },
    use: d => { data = migrated(d); reindex(); return data; }, setFetch: f => { adoFetch = f; }};`);
})();

const E = (date, task, hours, extra) => ({id: `${date}-${task}-${hours}`, date, activity: 'x', task, hours, ...extra});
const file = (entries, more) => ({version: 1, entries, ...more});
const item = (completed, iter) => ({title: 't', type: 'Task', parent: null, completed, remaining: null, rev: 1, state: 'Active', iter});
let n = 0;
const check = async (name, fn) => { await fn(); console.log('ok', ++n, name); };

// ---------- import ore da DevOps ----------
await check('ore caricate su DevOps il giorno dopo: nessun doppione', () => {
  T.use(file([E('2026-10-14', '1', 6)]));
  assert.equal(T.imports([{id: '1', date: '2026-10-15', hours: 6}], '2026-10-10').length, 0);
});
await check('diario con meno ore di DevOps: importa solo la differenza', () => {
  T.use(file([E('2026-10-14', '1', 2)]));
  assert.deepEqual(T.imports([{id: '1', date: '2026-10-14', hours: 6}], '2026-10-10').map(e => [e.date, e.hours]), [['2026-10-14', 4]]);
});
await check('riga importata e poi cancellata a mano: non torna', () => {
  const d = T.use(file([E('2026-10-14', '1', 2)]));
  T.imports([{id: '1', date: '2026-10-14', hours: 6}], '2026-10-10');
  d.entries = [];
  assert.equal(T.imports([{id: '1', date: '2026-10-14', hours: 6}], '2026-10-10').length, 0);
});

// ---------- ore non ancora su DevOps ----------
await check('ore scoperte attribuite alle righe più recenti del task', () => {
  const d = T.use(file([E('2026-10-13', '7', 3), E('2026-10-14', '7', 3)]));
  d.ado.items['7'] = item(4);
  assert.deepEqual([...T.unlogged()], [['2026-10-14-7-3', 2]]);
});
await check('task non ancora scaricato: nessun avviso', () => {
  T.use(file([E('2026-10-14', '8', 3)]));
  assert.equal(T.unlogged().size, 0);
});

// ---------- unione in caso di conflitto sul file ----------
await check('conflitto: unisce righe aggiunte/cancellate da entrambe le parti', () => {
  const a = E('2026-10-01', '1', 1), b = E('2026-10-02', '2', 2), c = E('2026-10-03', '3', 3);
  const base = T.migrated(file([a, b]));
  const local = T.migrated(file([a, {...b, hours: 5}, c]));        // qui: modifico b, aggiungo c
  const disk = T.migrated(file([b, E('2026-10-04', '4', 4)]));     // altrove: cancellano a, aggiungono d
  const m = T.merge(base, local, disk);
  assert.deepEqual(m.entries.map(e => [e.task, e.hours]), [['2', 5], ['3', 3], ['4', 4]]);
});
await check('conflitto: un campo cambiato solo altrove non viene perso', () => {
  const base = T.migrated(file([], {owner: 'A'})), local = T.migrated(file([], {owner: 'A'})), disk = T.migrated(file([], {owner: 'B'}));
  assert.equal(T.merge(base, local, disk).owner, 'B');
});

// ---------- migrazioni ----------
await check('flag allattamento → assenza ALL da 2 h solo nei giorni con ore lavorate', () => {
  const d = T.migrated(file([E('2026-10-01', '1', 6), E('2026-10-02', null, null, {activity: 'Ferie'})],
    {days: {'2026-10-01': {allattamento: true}, '2026-10-02': {allattamento: true}}}));
  assert.equal(d.days, undefined);
  assert.deepEqual(d.entries.filter(e => e.absence === 'ALL').map(e => [e.date, e.hours]), [['2026-10-01', 2]]);
  assert.equal(d.entries.find(e => e.date === '2026-10-02').absence, 'FER');
});

// ---------- sprint da DevOps ----------
const tree = {name: 'P', children: [
  {name: 'M2C R2', attributes: {startDate: '2026-07-01T00:00:00Z', finishDate: '2027-06-30T00:00:00Z'}, children: [
    {name: 'M2C-S7', attributes: {startDate: '2026-10-12T00:00:00Z', finishDate: '2026-10-23T00:00:00Z'}},
    {name: 'M2C-S8', attributes: {startDate: '2026-10-26T00:00:00Z', finishDate: '2026-11-06T00:00:00Z'}}]},
  {name: 'MDM R4', attributes: {startDate: '2026-07-01T00:00:00Z', finishDate: '2027-06-30T00:00:00Z'}, children: [
    {name: 'MDM-S2', attributes: {startDate: '2026-10-12T00:00:00Z', finishDate: '2026-10-23T00:00:00Z'}}]},
  {name: 'Altro', children: [{name: 'X-S1', attributes: {startDate: '2026-10-12T00:00:00Z', finishDate: '2026-10-23T00:00:00Z'}}]},
]};
T.setFetch(async () => tree);
await check('finestre sprint da DevOps: nome per date, una per periodo, release senza task ignorate', async () => {
  const d = T.use(file([E('2026-10-13', '1', 6), E('2026-10-14', '2', 2)]));
  d.ado.items['1'] = item(6, 'P\\M2C R2\\M2C-S7'); d.ado.items['2'] = item(2, 'P\\MDM R4\\MDM-S2');
  await T.adoSprints();
  assert.deepEqual(d.sprints.map(s => [s.name, s.start]), [['Sprint 12–23 ott', '2026-10-12'], ['Sprint 26 ott–6 nov', '2026-10-26']]);
});
await check('finestre sprint: quelle nascoste non tornano', async () => {
  const d = T.use(file([E('2026-10-13', '1', 6)], {sprintSkip: ['2026-10-26']}));
  d.ado.items['1'] = item(6, 'P\\M2C R2\\M2C-S7');
  await T.adoSprints();
  assert.deepEqual(d.sprints.map(s => s.start), ['2026-10-12']);
});
await check('formato vecchio: sprint a mano eliminati una volta sola, quelli DevOps rinominati', () => {
  const d = T.migrated(file([], {sprintDays: 14, sprints: [{name: 'Sprint 7', start: '2026-10-12', end: '2026-10-23'},
    {name: 'M2C-S8', start: '2026-10-26', end: '2026-11-06', ado: true}]}));
  assert.deepEqual(d.sprints, [{name: 'Sprint 26 ott–6 nov', start: '2026-10-26', end: '2026-11-06'}]);
  assert.equal('sprintDays' in d, false);
  assert.equal(T.migrated(d).sprints.length, 1); // una seconda apertura non li cancella
});
await check('ore per iterazione: tutte quelle lavorate nel periodo, assenze escluse', () => {
  const d = T.use(file([E('2026-10-13', '1', 6), E('2026-10-14', '2', 2), E('2026-10-14', null, 2, {activity: 'GEN AI'}),
    E('2026-10-15', null, 2, {absence: 'ALL'})]));
  d.ado.items['1'] = item(6, 'P\\M2C R2\\M2C-S7'); d.ado.items['2'] = item(2, 'P\\MDM R4\\MDM-S2');
  assert.deepEqual(T.iterHours('2026-10-12', '2026-10-23'), [['M2C-S7', 6], ['MDM-S2', 2], ['senza task DevOps', 2]]);
  assert.deepEqual(T.iterHours('2026-10-14', '2026-10-14', false), [['MDM-S2', 2]]);
});
await check('conflitto: la data dell\'ultima sync non si perde se una parte non ha mai sincronizzato', () => {
  const b = T.migrated(file([])), local = T.migrated(file([])), disk = T.migrated(file([]));
  disk.ado.syncedAt = '2026-10-25T08:00:00.000Z';
  assert.equal(T.merge(b, local, disk).ado.syncedAt, '2026-10-25T08:00:00.000Z');
});

// ---------- file nuovo ----------
await check('file nuovo e vuoto: si apre e la prima sync parte dall\'inizio dell\'anno', () => {
  const d = T.use({version: 1, entries: []});
  assert.deepEqual([d.sprints, d.ado.seen], [[], []]);
  assert.equal(T.syncSince(), T.today().slice(0, 4) + '-01-01');
});
await check('prima sync con righe già scritte a mano: ultimo mese; poi dall\'ultima sync meno una settimana', () => {
  const d = T.use(file([E('2026-10-14', '1', 6)]));
  assert.equal(T.syncSince(), T.addDays(T.today(), -30));
  d.ado.syncedTo = '2026-10-20';
  assert.equal(T.syncSince(), '2026-10-13');
});

// ---------- archivio su GitHub (fetch simulata) ----------
// finto repo: un file con sha; una PUT con sha diverso da quello attuale risponde 409 come GitHub
function fakeGitHub(initial) {
  const repo = {text: initial, sha: initial == null ? null : 'v1', puts: 0};
  globalThis.fetch = async (url, {method = 'GET', body} = {}) => {
    const res = (status, json) => ({status, ok: status < 300, json: async () => json});
    if (method === 'GET') return repo.text == null ? res(404) : res(200, {content: T.b64enc(repo.text), sha: repo.sha});
    const b = JSON.parse(body);
    if ((b.sha ?? null) !== repo.sha) return res(repo.sha ? (b.sha ? 409 : 422) : 409);
    repo.text = T.b64dec(b.content); repo.sha = 'v' + (++repo.puts + 1);
    return res(200, {content: {sha: repo.sha}});
  };
  return repo;
}
await check('GitHub: testo con accenti ed emoji sopravvive alla codifica base64', () => {
  const s = 'Attività · perché ⚠ 😀 ' + 'x'.repeat(70000);
  assert.equal(T.b64dec(T.b64enc(s)), s);
});
await check('GitHub: file assente → null; scrittura e rilettura con lo sha', async () => {
  const repo = fakeGitHub(null), s = T.ghStore({repo: 'u/r', path: 'attivita.json', token: 't'});
  assert.equal(await s.read(), null);
  const v = await s.write('{"version":1,"entries":[]}', null);
  assert.deepEqual(await s.read(), {text: '{"version":1,"entries":[]}', ver: v});
  await assert.rejects(s.write('altro', 'sha-vecchio'), e => e.conflict === true);
  assert.equal(repo.puts, 1);
});
await check('GitHub: salvataggio con file cambiato da un altro PC → unisce invece di sovrascrivere', async () => {
  const a = E('2026-10-01', '1', 1), b = E('2026-10-02', '2', 2);
  const repo = fakeGitHub(JSON.stringify(file([a])));
  const s = T.ghStore({repo: 'u/r', path: 'attivita.json', token: 't'});
  const d = T.use(file([a, b]));                                   // qui ho aggiunto b partendo da [a] (sha v1)
  T.setStore(s, 'v1', JSON.stringify(T.migrated(file([a]))));
  repo.text = JSON.stringify(file([a, E('2026-10-03', '3', 3)])); repo.sha = 'v9'; // intanto un altro PC aggiunge una riga
  await T.flush();
  assert.deepEqual(JSON.parse(repo.text).entries.map(e => e.task), ['1', '2', '3']);
  assert.equal(T.data.entries.length, 3);
});

console.log(`\n${n} controlli superati`);
