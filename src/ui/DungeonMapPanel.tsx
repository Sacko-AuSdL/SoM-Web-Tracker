import type { DungeonDefinition } from "../data/dungeons";

export function DungeonMapPanel({ dungeon }: { dungeon: DungeonDefinition }) {
  return <section className="dungeon-panel" aria-label={`Dungeon map: ${dungeon.name}`}>
    <div className="panel-heading"><div><span className="eyebrow">CURRENT DUNGEON</span><h2>{dungeon.name}</h2></div></div>
    <div className="dungeon-image-wrap"><img src={dungeon.imageUrl} alt={`${dungeon.name} dungeon map`} /></div>
  </section>;
}
