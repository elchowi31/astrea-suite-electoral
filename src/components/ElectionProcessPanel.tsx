import { useState } from 'react';
import type { DhondtSimulationParty, DhondtSimulationResult } from '../types';
import type { ElectionParameters } from '../lib/electoralSimulation';
import { listMembers } from '../lib/closedLists';

const format = (value: number) => value.toLocaleString('es-CO', { maximumFractionDigits: 3 });
const percent = (value: number) => value.toLocaleString('es-CO', { maximumFractionDigits: 2 }) + '%';

export function ElectionProcessPanel({
  parameters,
  result,
  singleSeat,
}: {
  parameters: ElectionParameters;
  result: DhondtSimulationResult;
  singleSeat: boolean;
}) {
  const listVotes = parameters.parties.reduce((sum, party) => sum + party.votes, 0);
  const twoSeats = !singleSeat && parameters.seats === 2;
  const senate = parameters.level === 'Senado de la República';
  const thresholdName = singleSeat
    ? 'No aplica'
    : senate
      ? '3% de los votos válidos'
      : twoSeats
        ? 'Más de 30% del cociente electoral'
        : '50% del cociente electoral';
  const uninominal = parameters.level === 'Alcaldía' || parameters.level === 'Gobernación';
  const methodName = singleSeat
    ? 'Mayoría relativa'
    : twoSeats
      ? 'Cociente electoral y mayores residuos'
      : 'Cifra repartidora D’Hondt';

  return (
    <section className="space-y-4 rounded-2xl border border-cyan-700/50 bg-slate-900 p-4 text-slate-100 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Proceso completo</p>
          <h3 className="mt-1 text-lg font-bold">Cómo se asignan las curules</h3>
          <p className="mt-1 text-xs text-slate-400">Método aplicado: {methodName}. Los votos individuales de candidatos determinan el orden interno en lista abierta, no el número de curules del partido.</p>
        </div>
        <span className="rounded-full border border-cyan-800 bg-cyan-950/60 px-3 py-1 text-xs text-cyan-200">{parameters.seats} curules</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <p className="text-xs text-slate-400">1 · Votos válidos</p>
          <p className="mt-1 text-lg font-bold">{format(result.totalValidVotes)}</p>
          <p className="text-xs text-slate-500">Incluye {format(result.blankVotes)} votos en blanco</p>
        </article>
        <article className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <p className="text-xs text-slate-400">2 · Cociente electoral</p>
          <p className="mt-1 text-lg font-bold">{singleSeat ? 'No aplica' : format(result.quotient)}</p>
          <p className="text-xs text-slate-500">{singleSeat ? 'Cargo uninominal' : format(result.totalValidVotes) + ' ÷ ' + parameters.seats}</p>
        </article>
        <article className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <p className="text-xs text-slate-400">3 · Umbral para participar</p>
          <p className="mt-1 text-lg font-bold">{singleSeat ? 'No aplica' : format(result.thresholdVotes) + ' votos'}</p>
          <p className="text-xs text-slate-500">{thresholdName}</p>
        </article>
        <article className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 p-3">
          <p className="text-xs text-emerald-200">4 · Resultado del reparto</p>
          <p className="mt-1 text-lg font-bold">{singleSeat ? 'Mayor votación' : twoSeats ? 'Cociente y residuos' : format(result.cifraRepartidora)}</p>
          <p className="text-xs text-slate-400">{singleSeat ? 'Sin cociente ni cifra repartidora' : twoSeats ? 'La cifra repartidora D’Hondt no aplica a dos curules' : 'Cifra repartidora: menor cociente que obtiene curul'}</p>
        </article>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
        <strong className="text-cyan-200">Conciliación del escrutinio:</strong> {format(result.totalVoters)} sufragantes − {format(result.nullVotes)} nulos − {format(result.unmarkedVotes)} no marcados = {format(result.totalValidVotes)} votos válidos. Estos incluyen {format(result.blankVotes)} blancos; quedan {format(listVotes)} votos para las listas.
      </div>

      {!singleSeat && <div className="space-y-2">
        <div>
          <h4 className="font-semibold">5 · Habilitación y saldo de cada partido</h4>
          <p className="text-xs text-slate-400">Superar el umbral habilita a competir. El umbral por sí solo no entrega una curul.</p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-950 text-slate-400"><tr>
              <th className="p-2">Partido / lista</th><th className="p-2 text-right">Votos de lista</th><th className="p-2 text-right">% válidos</th><th className="p-2">Umbral</th><th className="p-2 text-right">Curules</th><th className="p-2 text-right">Residuo / saldo</th>
            </tr></thead>
            <tbody>{result.allocationsByParty.map((party) => {
              const eligible = result.thresholdException ? party.totalVotes > 0 : party.passedThreshold;
              const directSeats = twoSeats && eligible && result.quotient > 0 ? Math.floor(party.totalVotes / result.quotient) : 0;
              const remainder = twoSeats && eligible ? party.totalVotes - directSeats * result.quotient : 0;
              return <tr key={party.partyId} className="border-t border-slate-800">
                <td className="p-2 font-medium" style={{ color: party.partyColor }}>{party.partyName}</td>
                <td className="p-2 text-right tabular-nums">{format(party.totalVotes)}</td>
                <td className="p-2 text-right tabular-nums">{percent(party.votePercentage)}</td>
                <td className="p-2">{singleSeat ? 'No aplica' : eligible ? <span className="text-emerald-300">Habilitado</span> : <span className="text-rose-300">Excluido</span>}</td>
                <td className="p-2 text-right font-bold tabular-nums">{party.seatsWon}</td>
                <td className="p-2 text-right tabular-nums">{singleSeat ? '—' : twoSeats ? format(remainder) : format(party.surplusVotes)}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {result.thresholdException && <p className="text-xs text-amber-200">Ninguna lista llegó al umbral. El reparto se calcula entre las listas con votos, según la excepción constitucional.</p>}
        {twoSeats ? <p className="text-xs text-slate-400">Con dos curules se asignan primero los cocientes completos. Las curules restantes se entregan a los residuos mayores. El cuadro muestra el residuo después de contar los cocientes completos.</p> : <p className="text-xs text-slate-400">Residuo / saldo = votos de lista − (curules obtenidas × cifra repartidora). Describe los votos que quedan frente al corte del reparto; no se vuelven a repartir.</p>}
      </div>}

      {twoSeats && <div className="space-y-2">
        <h4 className="font-semibold">6 · Cálculo del residuo para dos curules</h4>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="bg-slate-950 text-slate-400"><tr><th className="p-2">Partido / lista</th><th className="p-2 text-right">Votos</th><th className="p-2 text-right">Curules por cociente</th><th className="p-2 text-right">Residuo</th><th className="p-2 text-right">Curul por residuo</th><th className="p-2 text-right">Total</th></tr></thead>
            <tbody>{result.allocationsByParty.map((party) => {
              const eligible = result.thresholdException ? party.totalVotes > 0 : party.passedThreshold;
              const direct = eligible && result.quotient > 0 ? Math.floor(party.totalVotes / result.quotient) : 0;
              const remainder = eligible ? party.totalVotes - direct * result.quotient : 0;
              const extra = Math.max(0, party.seatsWon - direct);
              return <tr key={party.partyId} className="border-t border-slate-800"><td className="p-2">{party.partyName}</td><td className="p-2 text-right tabular-nums">{format(party.totalVotes)}</td><td className="p-2 text-right tabular-nums">{direct}</td><td className="p-2 text-right tabular-nums">{format(remainder)}</td><td className="p-2 text-right tabular-nums">{extra}</td><td className="p-2 text-right font-bold tabular-nums">{party.seatsWon}</td></tr>;
            })}</tbody>
          </table>
        </div>
      </div>}

      {!singleSeat && !twoSeats && <details open className="rounded-xl border border-slate-700 bg-slate-950 p-3">
        <summary className="cursor-pointer font-semibold text-cyan-200">6 · Matriz D’Hondt: votos ÷ 1, 2, 3… · mostrar cocientes y curules</summary>
        <p className="my-2 text-xs text-slate-400">Se ordenan los cocientes de todas las listas habilitadas. Los {parameters.seats} valores más altos ganan curul. El último cociente ganador es la cifra repartidora.</p>
        <div className="max-h-96 overflow-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-900 text-slate-400"><tr><th className="p-2">Orden</th><th className="p-2">Partido / lista</th><th className="p-2 text-right">Votos</th><th className="p-2 text-right">Divisor</th><th className="p-2 text-right">Cociente</th><th className="p-2">Asignación</th></tr></thead>
            <tbody>{result.dhondtMatrix.map((step, index) => {
              const party = parameters.parties.find((row) => row.id === step.partyId);
              return <tr key={step.partyId + '-' + step.divisor} className={'border-t border-slate-800 ' + (step.isSeatWinner ? 'bg-cyan-950/50 text-cyan-100' : 'text-slate-400')}>
                <td className="p-2 tabular-nums">{index + 1}</td><td className="p-2" style={{ color: step.partyColor }}>{step.partyName}</td><td className="p-2 text-right tabular-nums">{format(party?.votes ?? 0)}</td><td className="p-2 text-right tabular-nums">{step.divisor}</td><td className="p-2 text-right font-semibold tabular-nums">{step.quotient.toLocaleString('es-CO', { maximumFractionDigits: 6 })}</td><td className="p-2">{step.isSeatWinner ? 'Curul ' + step.seatWonNumber : 'Fuera del corte'}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-emerald-200">Cifra repartidora = {format(result.cifraRepartidora)}. Cada partido obtiene tantas curules como cocientes suyos queden dentro de los primeros {parameters.seats}.</p>
      </details>}

      {singleSeat && <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm"><strong>Proceso:</strong> se adjudica el cargo a la candidatura con más votos. No se calcula umbral, cociente electoral ni cifra repartidora.</div>}

      {!uninominal && <CandidateVoteDetails parameters={parameters} result={result} />}
    </section>
  );
}

function CandidateVoteDetails({
  parameters,
  result,
}: {
  parameters: ElectionParameters;
  result: DhondtSimulationResult;
}) {
  const [showAll, setShowAll] = useState(false);
  return (
    <div className="space-y-2 border-t border-slate-700 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h4 className="font-semibold">7 · Votos por candidato</h4>
          <p className="mt-1 text-xs text-slate-400">Cada partido conserva sus votos de lista. En lista abierta, las preferencias ordenan a los candidatos; los votos solo al partido también cuentan para las curules. En lista cerrada, las curules siguen el orden inscrito.</p>
        </div>
        <button type="button" className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-cyan-200 hover:bg-slate-900" onClick={() => setShowAll(!showAll)}>{showAll ? 'Contraer listas' : 'Ver candidatos de todos los partidos'}</button>
      </div>
      <div className="space-y-2">{parameters.parties.map((party: DhondtSimulationParty) => {
        const allocation = result.allocationsByParty.find((row) => row.partyId === party.id);
        const members = party.candidateVotes || [];
        const memberTotal = members.reduce((sum, row) => sum + row.votes, 0);
        const unassigned = Math.max(0, party.votes - memberTotal);
        const assigned = listMembers(party, allocation?.seatsWon || 0);
        const electedIds = new Set(assigned.members.map((row) => row.id));
        const ordered = [...members].sort((a, b) => party.listKind === 'closed' ? a.position - b.position : b.votes - a.votes || a.position - b.position);
        const kind = party.listKind || 'open';
        return <details key={party.id} open={showAll || !!party.isUserParty} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm font-semibold">
            <span style={{ color: party.color }}>{party.name}</span>
            <span className="text-xs text-slate-400">{format(party.votes)} votos · {allocation?.seatsWon || 0} curules · {members.length} registros</span>
          </summary>
          {members.length === 0 ? <p className="mt-3 text-xs text-slate-400">Esta fuente solo trae el total por partido. Abra “Aspirantes y orden de adjudicación” para ingresar nombres y votos por candidato.</p> : <>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-900 p-2"><p className="text-xs text-slate-400">Total del partido</p><p className="font-bold">{format(party.votes)}</p></div>
              <div className="rounded-lg bg-slate-900 p-2"><p className="text-xs text-slate-400">Votos preferentes registrados</p><p className="font-bold">{format(memberTotal)}</p></div>
              <div className="rounded-lg bg-slate-900 p-2"><p className="text-xs text-slate-400">Votos solo por la lista</p><p className="font-bold">{format(unassigned)}</p></div>
            </div>
            {kind === 'closed' && <p className="my-2 text-xs text-amber-200">Se está simulando lista cerrada. Los votos preferentes mostrados son datos de referencia y no ordenan las curules; manda la posición inscrita.</p>}
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-slate-900 text-slate-400"><tr><th className="p-2">Código / orden</th><th className="p-2">Candidato</th><th className="p-2 text-right">{kind === 'closed' ? 'Preferencias de referencia' : 'Votos individuales'}</th><th className="p-2">Adjudicación simulada</th></tr></thead>
                <tbody>{ordered.map((member) => <tr key={member.id} className="border-t border-slate-800"><td className="p-2 tabular-nums">{member.position}</td><td className="p-2">{member.name}</td><td className="p-2 text-right tabular-nums">{kind === 'closed' && member.votes === 0 ? 'No aplica' : format(member.votes)}</td><td className="p-2">{assigned.pendingTie ? <span className="text-amber-200">Empate pendiente</span> : electedIds.has(member.id) ? <span className="text-emerald-300">Curul asignada</span> : '—'}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">La suma preferente no siempre coincide con el total del partido. La diferencia corresponde a votos solo por la lista y conserva su efecto en el reparto de curules.</p>
          </>}
        </details>;
      })}</div>
    </div>
  );
}

