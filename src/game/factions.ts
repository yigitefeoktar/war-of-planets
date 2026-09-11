export const FACTION_TRAITS = [
  { color: '#3b82f6', name: 'Blue · Guardians', bonus: '10% fewer defending losses', detail: 'You · Every tenth clash saves a defending ship.' },
  { color: '#ef4444', name: 'Red · Raiders', bonus: '+10% attack effectiveness', detail: 'Frequent attacks · Every tenth clash destroys an extra defender, if present.' },
  { color: '#22c55e', name: 'Green · Industrialists', bonus: '+10% ship production', detail: 'Expansion focused · One extra ship every ten production cycles.' },
  { color: '#eab308', name: 'Yellow · Engineers', bonus: '+10% energy production', detail: 'Prioritises energy objectives · Applies when superweapons are available.' },
] as const;

export const productionMultiplier = (color: string) => color === '#22c55e' ? 1.1 : 1;
export const energyMultiplier = (color: string) => color === '#eab308' ? 1.1 : 1;
export const attackMultiplier = (color: string) => color === '#ef4444' ? 1.1 : 1;
export const defenceMultiplier = (color: string) => color === '#3b82f6' ? 1 / 0.9 : 1;

/** Small, deterministic bonuses. Ownership changes reset local progress. */
export class FactionBonuses {
  private progress = new Map<string, { owner: string; production: number; attack: number; defence: number }>();
  reset(id: string) { this.progress.delete(id); }
  private at(id: string, owner: string) {
    let state = this.progress.get(id);
    if (!state || state.owner !== owner) {
      state = { owner, production: 0, attack: 0, defence: 0 };
      this.progress.set(id, state);
    }
    return state;
  }
  production(id: string, owner: string) {
    const state = this.at(id, owner);
    return 1 + Number(owner === '#22c55e' && ++state.production % 10 === 0);
  }
  clash(id: string, owner: string, attacker: string) {
    const state = this.at(id, owner);
    return {
      saveDefender: owner === '#3b82f6' && ++state.defence % 10 === 0,
      extraDefender: attacker === '#ef4444' && ++state.attack % 10 === 0,
    };
  }
}
