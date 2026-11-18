import React, { useState } from 'react';
import type { DhondtSimulationParty } from '../types';
import { parseListMembers, listMembers } from '../lib/closedLists';
export function SimulatorListMembers({
  party,
  seats,
  onChange,
}: {
  key?: React.Key;
  party: DhondtSimulationParty;
  seats: number;
  onChange: (party: DhondtSimulationParty) => void;
}) {
  const [text, setText] = useState(() =>
      (party.candidateVotes || [])
        .map((row) =>
          party.listKind === 'closed' ? row.name : `${row.name} | ${row.votes}`,
        )
        .join('\n'),
    ),
    [error, setError] = useState('');
  const assigned = listMembers(party, seats);
  return (
    <details className="rounded-xl border border-slate-700 bg-slate-950 p-3">
      <summary className="cursor-pointer text-sm font-semibold">
        {party.name} ·{' '}
        {party.listKind === 'closed'
          ? 'Cerrada: orden inscrito'
          : 'Abierta: voto preferente'}{' '}
        · {seats} curules
      </summary>
      <p className="my-2 text-xs text-slate-400">
        {party.listKind === 'closed'
          ? 'Escriba un aspirante por línea, en el orden inscrito.'
          : 'Una línea por aspirante: Nombre | votos individuales. El total de la lista incluye también votos solo por el partido.'}
      </p>
      <textarea
        aria-label={`Aspirantes ${party.name}`}
        className="compact-input"
        rows={4}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button
        className="compact-button mt-2"
        onClick={() => {
          try {
            const members = parseListMembers(text, party);
            onChange({
              ...party,
              candidateVotes: members,
              candidatesCount: members.length || undefined,
            });
            setError('');
          } catch (error) {
            setError((error as Error).message);
          }
        }}
      >
        Aplicar aspirantes
      </button>
      {error && <p role="alert">{error}</p>}
      {assigned.pendingTie ? (
        <p className="mt-2 text-amber-200">
          Empate individual en el corte: el simulador no decide el sorteo
          oficial.
        </p>
      ) : (
        <ol className="mt-2 list-inside list-decimal text-sm">
          {assigned.members.map((row) => (
            <li key={row.id}>
              {row.name}
              {party.listKind !== 'closed' ? ` · ${row.votes} votos` : ''}
            </li>
          ))}
        </ol>
      )}
      {assigned.missingNames > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          Registre aspirantes para identificar {assigned.missingNames} curules
          asignadas. La cantidad de curules de la lista se calcula con los votos
          totales.
        </p>
      )}
    </details>
  );
}
