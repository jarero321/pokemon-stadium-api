import type { ILogger } from '#core/interfaces/index.js';
import type { ILobbyRepository } from '#core/interfaces/index.js';
import type { IPokemonApiService } from '#core/interfaces/index.js';
import type { Lobby } from '#core/entities/index.js';
import type { Pokemon } from '#core/entities/index.js';
import {
  LobbyNotFoundError,
  PlayerNotInLobbyError,
} from '#core/errors/index.js';

export class AssignPokemon {
  constructor(
    private readonly lobbyRepository: ILobbyRepository,
    private readonly pokemonApi: IPokemonApiService,
    private readonly logger: ILogger,
  ) {}

  async execute(socketId: string): Promise<Lobby> {
    const lobby = await this.lobbyRepository.findActive();
    if (!lobby) throw new LobbyNotFoundError();

    const player = lobby.players.find((p) => p.socketId === socketId);
    if (!player) throw new PlayerNotInLobbyError();

    const catalog = await this.pokemonApi.getList();

    const assignedIds = lobby.players.flatMap((p) => p.team.map((pk) => pk.id));
    const available = catalog.filter((p) => !assignedIds.includes(p.id));

    const shuffled = available.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 3);

    const details = await this.pokemonApi.getByIds(selected.map((s) => s.id));

    player.team = details.map(
      (d): Pokemon => ({
        id: d.id,
        name: d.name,
        type: d.type,
        hp: d.hp,
        maxHp: d.hp,
        attack: d.attack,
        defense: d.defense,
        speed: d.speed,
        sprite: d.sprite,
        defeated: false,
      }),
    );

    player.activePokemonIndex = 0;
    lobby.updatedAt = new Date();

    const updated = await this.lobbyRepository.update(lobby);

    this.logger.info('Pokemon team assigned', {
      nickname: player.nickname,
      team: player.team.map((p) => p.name),
    });

    return updated;
  }
}
