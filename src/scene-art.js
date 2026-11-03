// Art direction for Football Life. Every story scene has a contextual
// high-resolution illustration. Add new IDs here as narrative content grows.
// Artwork stays in our own GitHub Pages build, not third-party hotlinks.
const groups = {
  stadium_tunnel: [
    'match','waiting','memoryOpportunity','npcCoachPromotion'
  ],
  training: [
    'training','coach','captain','mentor','memorySelection','memoryTeam',
    'npcCoachContest','npcCoachDrill','npcCaptainAlliance','npcTeamBond',
    'npcRivalCompetition'
  ],
  recovery: [
    'training-rest','rehab','recovery'
  ],
  contract: [
    'offer','agentDeal','agentLeak','agentFreeze','memoryAgent','memoryBoard',
    'investment','sponsor','npcAgentSecret','npcAgentContact','adultFinances','adultBudget'
  ],
  transfer: [
    'move','memoryRelocation','npcRivalTransfer','npcPartnerCareer',
    'travel','adultWork','adultWorkUltimatum'
  ],
  romance: [
    'meet','date','commit','moveIn','wedding','adultFlirt','adultFriends','memoryPromise',
    'npcPartnerPlans'
  ],
  intimacy: [
    'intimacy','adultIntimacy','adultBoundaries','adultAftercare'
  ],
  nightlife: [
    'nightlife','secret','adultNightClub','adultSecret'
  ],
  press: [
    'photo','public','publicity','interview','sponsorIntro','sponsorThreat',
    'memoryEvidence','adultPrivacy','adultPhoto','adultMediaLeak','adultPressure'
  ],
  conflict: [
    'fight','jealousy','partnerDoubt','affairExposure','rememberedHurt',
    'memoryRelationship','adultCrisis','adultHonesty','adultSecretDiscovery',
    'adultRepair','npcPartnerDistance'
  ]
};
const imageByScene=Object.fromEntries(
  Object.entries(groups).flatMap(([art,ids])=>ids.map(id=>[id,art]))
);
const fallback={
  stadium:'stadium_tunnel',contract:'contract',romance:'romance',
  media:'press',night:'nightlife'
};
export function artForScene(scene,kind='stadium'){
  return scene?.art || imageByScene[scene?.id] || fallback[kind] || 'stadium_tunnel';
}
export function artUrl(name){
  return import.meta.env.BASE_URL+'art/'+name+'.webp';
}
export const allArtGroups=groups;
