import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Biohazard,
  BookOpen,
  Bot,
  Crosshair,
  Dices,
  Factory,
  Flame,
  Play,
  Radio,
  RotateCcw,
  Shield,
  ShieldCheck,
  Skull,
  Target,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";

type Nation = {
  id: string;
  name: string;
  short: string;
  population: number;
  defense: number;
  missiles: number;
  color: string;
  ai: string;
  streak: number;
  lastBuild: string;
};

type Hate = Record<string, Record<string, number>>;

type Log = {
  turn: number;
  actor: string;
  text: string;
};

type Visual = {
  kind: string;
  actor: string;
  to?: string;
  blocked?: boolean;
} | null;

type SetupNation = {
  id: string;
  name: string;
  short: string;
  population: number;
  defense: number;
  missiles: number;
  hateToPlayer: number;
  color: string;
  ai: string;
};

const IDS = ["player", "north", "ember", "isles", "vault"];

const DEFAULT_SETUP: SetupNation[] = [
  {
    id: "player",
    name: "曙光共和國",
    short: "曙光",
    population: 38,
    defense: 2,
    missiles: 2,
    hateToPlayer: 20,
    color: "cyan",
    ai: "player",
  },
  {
    id: "north",
    name: "北境聯盟",
    short: "北境",
    population: 32,
    defense: 3,
    missiles: 2,
    hateToPlayer: 52,
    color: "slate",
    ai: "defensive",
  },
  {
    id: "ember",
    name: "赤焰共同體",
    short: "赤焰",
    population: 41,
    defense: 2,
    missiles: 3,
    hateToPlayer: 58,
    color: "red",
    ai: "aggressive",
  },
  {
    id: "isles",
    name: "群島議會",
    short: "群島",
    population: 24,
    defense: 2,
    missiles: 1,
    hateToPlayer: 46,
    color: "green",
    ai: "propaganda",
  },
  {
    id: "vault",
    name: "地堡公國",
    short: "地堡",
    population: 19,
    defense: 3,
    missiles: 2,
    hateToPlayer: 55,
    color: "violet",
    ai: "defensive",
  },
];

const COMMANDS = [
  {
    id: "propaganda",
    label: "政治宣傳",
    Icon: Radio,
    help: "吸收目標 1–3M 人口",
  },
  {
    id: "produce",
    label: "生產核彈",
    Icon: Factory,
    help: "依人口生產 1–5 枚",
  },
  {
    id: "defend",
    label: "部署防禦",
    Icon: ShieldCheck,
    help: "防禦 +1，上限 3",
  },
  {
    id: "attack",
    label: "發射核彈",
    Icon: Crosshair,
    help: "消耗 1 枚核彈攻擊目標",
  },
];

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const randomInt = (minimum: number, maximum: number) =>
  Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;

const clamp = (number: number, minimum = 20, maximum = 100) =>
  Math.max(minimum, Math.min(maximum, number));

function makeGame(setup: SetupNation[]) {
  const nations: Nation[] = setup.map(({ hateToPlayer, ...nation }) => ({
    ...nation,
    streak: 0,
    lastBuild: "",
  }));

  const hate: Hate = {};

  IDS.forEach((observer) => {
    hate[observer] = {};

    IDS.forEach((subject) => {
      if (observer !== subject) {
        hate[observer][subject] = randomInt(40, 60);
      }
    });
  });

  setup
    .filter((nation) => nation.id !== "player")
    .forEach((nation) => {
      hate[nation.id].player = clamp(nation.hateToPlayer);
    });

  return {
    nations,
    hate,
  };
}

function produced(population: number) {
  const populationBase = 1 + Math.floor(population / 18);
  const randomBonus = randomInt(0, 2);

  return Math.max(1, Math.min(5, populationBase + randomBonus));
}

function hateClass(value: number) {
  if (value <= 40) {
    return "hate green";
  }

  if (value <= 70) {
    return "hate yellow";
  }

  return "hate red";
}

function beep(kind: string, enabled: boolean) {
  if (!enabled) {
    return;
  }

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as {
      webkitAudioContext: typeof AudioContext;
    }).webkitAudioContext;

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  const sounds: Record<string, [number, OscillatorType]> = {
    produce: [170, "square"],
    defend: [340, "triangle"],
    propaganda: [520, "sine"],
    attack: [100, "sawtooth"],
    death: [48, "sawtooth"],
  };

  const [frequency, oscillatorType] =
    sounds[kind] || [440, "sine"];

  oscillator.frequency.value = frequency;
  oscillator.type = oscillatorType;

  gain.gain.setValueAtTime(0.06, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    context.currentTime + 0.25,
  );

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + 0.25);
}

export default function App() {
  const [setup, setSetup] = useState<SetupNation[]>(() =>
    structuredClone(DEFAULT_SETUP),
  );

  const initial = useRef(makeGame(DEFAULT_SETUP));

  const [started, setStarted] = useState(false);
  const [nations, setNations] = useState(initial.current.nations);
  const [hate, setHate] = useState(initial.current.hate);
  const [turn, setTurn] = useState(1);
  const [target, setTarget] = useState("ember");
  const [command, setCommand] = useState("propaganda");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("玩家待命");
  const [visual, setVisual] = useState<Visual>(null);
  const [audio, setAudio] = useState(true);
  const [playerDefeated, setPlayerDefeated] = useState(false);

  const [logs, setLogs] = useState<Log[]>([
    {
      turn: 0,
      actor: "系統",
      text: "五國進入高度戒備。",
    },
  ]);

  const nationsRef = useRef(nations);
  const hateRef = useRef(hate);

  nationsRef.current = nations;
  hateRef.current = hate;

  const player = nations[0];
  const livingNations = nations.filter(
    (nation) => nation.population > 0,
  );

  const winner =
    !playerDefeated && livingNations.length === 1
      ? livingNations[0]
      : null;

  const commitNations = (
    update: (current: Nation[]) => Nation[],
  ) => {
    const next = update(nationsRef.current);
    nationsRef.current = next;
    setNations(next);
  };

  const commitHate = (
    update: (current: Hate) => Hate,
  ) => {
    const next = update(structuredClone(hateRef.current));
    hateRef.current = next;
    setHate(next);
  };

  const addLog = (text: string, actor = "系統") => {
    setLogs((current) => [
      {
        turn,
        actor,
        text,
      },
      ...current,
    ]);
  };

  const updateSetup = (
    id: string,
    key: keyof SetupNation,
    value: number,
  ) => {
    setSetup((current) =>
      current.map((nation) =>
        nation.id === id
          ? {
              ...nation,
              value,
            }
          : nation,
      ),
    );
  };

  const randomizeSetup = () => {
    setSetup((current) =>
      current.map((nation) => ({
        ...nation,
        population: randomInt(18, 55),
        missiles: randomInt(0, 5),
        defense: randomInt(0, 3),
        hateToPlayer:
          nation.id === "player"
            ? 20
            : randomInt(40, 60),
      })),
    );
  };

  function begin() {
    const newGame = makeGame(setup);

    nationsRef.current = newGame.nations;
    hateRef.current = newGame.hate;

    setNations(newGame.nations);
    setHate(newGame.hate);

    setTurn(1);
    setTarget(
      setup.find((nation) => nation.id !== "player")!.id,
    );
    setCommand("propaganda");
    setPhase("玩家待命");
    setBusy(false);
    setPlayerDefeated(false);

    setLogs([
      {
        turn: 0,
        actor: "系統",
        text: "依開局設定建立新戰局。",
      },
    ]);

    setStarted(true);
  }

  function changeHate(
    observer: string,
    subject: string,
    delta: number,
  ) {
    if (observer === subject) {
      return;
    }

    commitHate((current) => {
      const rawValue =
        (current[observer][subject] ?? 40) + delta;

      const overflow = Math.max(0, rawValue - 100);

      current[observer][subject] = clamp(rawValue);

      if (overflow > 0) {
        Object.keys(current[observer])
          .filter((other) => other !== subject)
          .forEach((other) => {
            current[observer][other] = clamp(
              current[observer][other] - overflow,
            );
          });
      }

      return current;
    });
  }

  function relief(
    attacker: string,
    victim: string,
    amount: number,
  ) {
    IDS.filter(
      (id) => id !== attacker && id !== victim,
    ).forEach((observer) => {
      const observerNation = nationsRef.current.find(
        (nation) => nation.id === observer,
      );

      if (
        observerNation &&
        observerNation.population > 0 &&
        (hateRef.current[observer]?.[victim] ?? 0) > 70
      ) {
        changeHate(observer, attacker, -amount);
      }
    });
  }

  function weightedTarget(actor: string) {
    const options = nationsRef.current.filter(
      (nation) =>
        nation.id !== actor && nation.population > 0,
    );

    if (options.length === 0) {
      return undefined;
    }

    const total = options.reduce(
      (sum, nation) =>
        sum +
        (hateRef.current[actor]?.[nation.id] ?? 40),
      0,
    );

    let roll = Math.random() * total;

    for (const nation of options) {
      roll -=
        hateRef.current[actor]?.[nation.id] ?? 40;

      if (roll <= 0) {
        return nation.id;
      }
    }

    return options.at(-1)?.id;
  }

  function isPlayerDead() {
    const currentPlayer = nationsRef.current.find(
      (nation) => nation.id === "player",
    );

    return (
      !currentPlayer || currentPlayer.population <= 0
    );
  }

  function endGameIfPlayerDead() {
    if (!isPlayerDead()) {
      return false;
    }

    setPlayerDefeated(true);
    setPhase("遊戲結束");
    setBusy(false);

    return true;
  }

  async function show(
    kind: string,
    actor: string,
    to?: string,
    blocked = false,
  ) {
    setVisual({
      kind,
      actor,
      to,
      blocked,
    });

    beep(kind, audio);

    await wait(kind === "attack" ? 850 : 560);

    setVisual(null);
  }

  async function die(victimId: string, killerId: string) {
    const victim = nationsRef.current.find(
      (nation) => nation.id === victimId,
    );

    if (!victim || victim.population > 0) {
      return;
    }

    setVisual({
      kind: "death",
      actor: victim.name,
    });

    beep("death", audio);

    await wait(600);

    setVisual(null);

    addLog(
      `${victim.name}人口歸零，立即滅亡並退出行動。`,
      victim.name,
    );

    if (victimId === "player") {
      setPlayerDefeated(true);
      setPhase("遊戲結束");
      setBusy(false);
      return;
    }

    relief(killerId, victimId, 20);
  }

  async function act(
    actorId: string,
    kind: string,
    wantedTarget?: string,
  ) {
    if (playerDefeated || isPlayerDead()) {
      return;
    }

    const actor = nationsRef.current.find(
      (nation) => nation.id === actorId,
    );

    if (!actor || actor.population <= 0) {
      return;
    }

    const victimId = nationsRef.current.some(
      (nation) =>
        nation.id === wantedTarget &&
        nation.population > 0 &&
        nation.id !== actorId,
    )
      ? wantedTarget
      : weightedTarget(actorId);

    const victim = nationsRef.current.find(
      (nation) => nation.id === victimId,
    );

    setPhase(`${actor.short}正在行動`);

    if (kind === "produce" || kind === "defend") {
      const streak =
        actor.lastBuild === kind
          ? actor.streak + 1
          : 1;

      if (kind === "produce") {
        const quantity = produced(actor.population);

        await show("produce", actor.name);

        commitNations((current) =>
          current.map((nation) =>
            nation.id === actorId
              ? {
                  ...nation,
                  missiles:
                    nation.missiles + quantity,
                  lastBuild: kind,
                  streak,
                }
              : nation,
          ),
        );

        addLog(
          `${actor.name}生產 ${quantity} 枚核彈，庫存 ${
            actor.missiles + quantity
          }。`,
          actor.name,
        );
      } else {
        await show("defend", actor.name);

        commitNations((current) =>
          current.map((nation) =>
            nation.id === actorId
              ? {
                  ...nation,
                  defense: Math.min(
                    3,
                    nation.defense + 1,
                  ),
                  lastBuild: kind,
                  streak,
                }
              : nation,
          ),
        );

        addLog(
          `${actor.name}部署防禦，目前 ${Math.min(
            3,
            actor.defense + 1,
          )}/3。`,
          actor.name,
        );
      }

      if (streak >= 2) {
        IDS.filter((id) => id !== actorId).forEach(
          (id) => {
            const otherNation =
              nationsRef.current.find(
                (nation) => nation.id === id,
              );

            if (
              otherNation &&
              otherNation.population > 0
            ) {
              changeHate(id, actorId, 5);
            }
          },
        );
      }

      return;
    }

    commitNations((current) =>
      current.map((nation) =>
        nation.id === actorId
          ? {
              ...nation,
              lastBuild: "",
              streak: 0,
            }
          : nation,
      ),
    );

    if (kind === "propaganda" && victim) {
      await show(
        "propaganda",
        actor.name,
        victim.name,
      );

      const moved = randomInt(1, 3);

      commitNations((current) =>
        current.map((nation) => {
          if (nation.id === actorId) {
            return {
              ...nation,
              population:
                nation.population + moved,
            };
          }

          if (nation.id === victim.id) {
            return {
              ...nation,
              population: Math.max(
                0,
                nation.population - moved,
              ),
            };
          }

          return nation;
        }),
      );

      changeHate(victim.id, actorId, 5);
      relief(actorId, victim.id, 10);

      addLog(
        `${actor.name}對${victim.name}發動政治宣傳，吸收 ${moved}M 人口。`,
        actor.name,
      );

      await die(victim.id, actorId);
      return;
    }

    if (kind === "attack" && victim) {
      if (actor.missiles <= 0) {
        await act(actorId, "produce");
        return;
      }

      const blocked =
        victim.defense > 0 &&
        Math.random() < 0.6;

      await show(
        "attack",
        actor.name,
        victim.name,
        blocked,
      );

      const damage = randomInt(4, 7);

      commitNations((current) =>
        current.map((nation) => {
          if (nation.id === actorId) {
            return {
              ...nation,
              missiles: Math.max(
                0,
                nation.missiles - 1,
              ),
            };
          }

          if (nation.id === victim.id) {
            return {
              ...nation,
              defense: Math.max(
                0,
                nation.defense - 1,
              ),
              population: blocked
                ? nation.population
                : Math.max(
                    0,
                    nation.population - damage,
                  ),
            };
          }

          return nation;
        }),
      );

      changeHate(
        victim.id,
        actorId,
        blocked ? 5 : 10,
      );

      if (!blocked) {
        relief(actorId, victim.id, 10);
      }

      if (blocked) {
        addLog(
          `${victim.name}成功攔截${actor.name}的核彈，防禦剩 ${Math.max(
            0,
            victim.defense - 1,
          )}/3。`,
          actor.name,
        );
      } else {
        addLog(
          `${actor.name}核彈命中${victim.name}，造成 ${damage}M 人口損失。`,
          actor.name,
        );
      }

      await die(victim.id, actorId);
    }
  }

  function aiPlan(actor: Nation) {
    const roll = Math.random();

    if (
      actor.missiles > 0 &&
      (actor.ai === "aggressive"
        ? roll < 0.68
        : roll < 0.42)
    ) {
      return "attack";
    }

    if (
      actor.ai === "defensive" &&
      actor.defense < 3 &&
      roll < 0.65
    ) {
      return "defend";
    }

    if (
      actor.ai === "propaganda" &&
      roll < 0.72
    ) {
      return "propaganda";
    }

    return roll > 0.65
      ? "produce"
      : "propaganda";
  }

  async function round() {
    if (
      busy ||
      playerDefeated ||
      winner ||
      isPlayerDead()
    ) {
      return;
    }

    setBusy(true);

    await act("player", command, target);

    if (endGameIfPlayerDead()) {
      return;
    }

    for (
      let index = 1;
      index < nationsRef.current.length;
      index += 1
    ) {
      const ai = nationsRef.current[index];

      if (ai.population <= 0) {
        continue;
      }

      await act(
        ai.id,
        aiPlan(ai),
        weightedTarget(ai.id),
      );

      if (endGameIfPlayerDead()) {
        return;
      }
    }

    setTurn((current) => current + 1);
    setPhase("玩家待命");
    setBusy(false);

    const selectedTarget =
      nationsRef.current.find(
        (nation) =>
          nation.id === target &&
          nation.population > 0,
      );

    if (!selectedTarget) {
      const firstLivingEnemy =
        nationsRef.current.find(
          (nation) =>
            nation.id !== "player" &&
            nation.population > 0,
        );

      if (firstLivingEnemy) {
        setTarget(firstLivingEnemy.id);
      }
    }
  }

  function reset() {
    setStarted(false);
    setBusy(false);
    setPlayerDefeated(false);
    setPhase("玩家待命");
    setSetup(structuredClone(DEFAULT_SETUP));
  }

  if (!started) {
    return (
      <main className="screen landing">
        <div className="shell setup-shell">
          <span className="version">
            <Flame size={14} />
            V4.2 開局設定
          </span>

          <h1>末日協議</h1>

          <p>
            設定五個陣營的開局人口、核彈、防禦，
            以及各 AI 對玩家的仇恨值。
          </p>

          <div className="setup-actions">
            <button
              className="secondary"
              onClick={randomizeSetup}
            >
              <Dices size={18} />
              隨機設定
            </button>

            <button
              className="secondary"
              onClick={() =>
                setSetup(
                  structuredClone(DEFAULT_SETUP),
                )
              }
            >
              <RotateCcw size={18} />
              恢復預設
            </button>
          </div>

          <div className="setup-list">
            {setup.map((nation) => (
              <section
                className="setup-card"
                key={nation.id}
              >
                <div className="row">
                  <b>{nation.name}</b>

                  {nation.id === "player" && (
                    <span className="chip">
                      玩家
                    </span>
                  )}
                </div>

                <div className="setup-grid">
                  <label>
                    人口 M
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={nation.population}
                      onChange={(event) =>
                        updateSetup(
                          nation.id,
                          "population",
                          clamp(
                            Number(event.target.value),
                            1,
                            100,
                          ),
                        )
                      }
                    />
                  </label>

                  <label>
                    核彈
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={nation.missiles}
                      onChange={(event) =>
                        updateSetup(
                          nation.id,
                          "missiles",
                          clamp(
                            Number(event.target.value),
                            0,
                            20,
                          ),
                        )
                      }
                    />
                  </label>

                  <label>
                    防禦
                    <input
                      type="number"
                      min="0"
                      max="3"
                      value={nation.defense}
                      onChange={(event) =>
                        updateSetup(
                          nation.id,
                          "defense",
                          clamp(
                            Number(event.target.value),
                            0,
                            3,
                          ),
                        )
                      }
                    />
                  </label>

                  {nation.id !== "player" && (
                    <label>
                      對玩家仇恨
                      <input
                        type="number"
                        min="20"
                        max="100"
                        value={nation.hateToPlayer}
                        onChange={(event) =>
                          updateSetup(
                            nation.id,
                            "hateToPlayer",
                            clamp(
                              Number(
                                event.target.value,
                              ),
                              20,
                              100,
                            ),
                          )
                        }
                      />
                    </label>
                  )}
                </div>
              </section>
            ))}
          </div>

          <button
            className="primary"
            onClick={begin}
          >
            <Play size={20} />
            依此設定開始戰局
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <div className="shell">
        <header className="top">
          <div className="topline">
            <div>
              <small>回合 {turn}</small>
              <h2>{phase}</h2>
            </div>

            <div>
              <button
                className="icon"
                onClick={() =>
                  setAudio((current) => !current)
                }
              >
                {audio ? (
                  <Volume2 />
                ) : (
                  <VolumeX />
                )}
              </button>

              <button
                className="icon"
                onClick={reset}
              >
                <RotateCcw />
              </button>
            </div>
          </div>

          <div className="stats">
            {[
              [Users, "人口", `${player.population}M`],
              [Target, "核彈", player.missiles],
              [Shield, "防禦", `${player.defense}/3`],
              [
                Biohazard,
                "存活",
                livingNations.length,
              ],
            ].map(([Icon, label, value]: any) => (
              <div
                className="stat"
                key={label}
              >
                <Icon size={16} />
                <small>{label}</small>
                <b>{value}</b>
              </div>
            ))}
          </div>
        </header>

        <section className="content">
          <div className="section-title">
            <h2>選擇目標</h2>

            <span className="chip">
              <Bot size={14} />
              仇恨加權 AI
            </span>
          </div>

          <div className="nation-list">
            {nations.slice(1).map((nation) => {
              const dead = nation.population <= 0;

              const hateToPlayer =
                hate[nation.id]?.player ?? 40;

              return (
                <motion.button
                  key={nation.id}
                  disabled={dead || busy}
                  whileTap={{
                    scale: 0.98,
                  }}
                  onClick={() =>
                    setTarget(nation.id)
                  }
                  className={`nation ${
                    target === nation.id && !dead
                      ? "selected"
                      : ""
                  } ${dead ? "dead" : ""}`}
                >
                  <span
                    className={`flag ${nation.color}`}
                  >
                    {dead ? (
                      <Skull size={20} />
                    ) : (
                      nation.short[0]
                    )}
                  </span>

                  <span className="nation-main">
                    <span className="row">
                      <b>{nation.name}</b>
                      <b>{nation.population}M</b>
                    </span>

                    <span className="row sub">
                      <span>
                        核彈 {nation.missiles} ·
                        防禦 {nation.defense}/3
                      </span>

                      <span
                        className={hateClass(
                          hateToPlayer,
                        )}
                      >
                        對我仇恨 {hateToPlayer}
                      </span>
                    </span>
                  </span>
                </motion.button>
              );
            })}
          </div>

          <h2>選擇命令</h2>

          <div className="commands">
            {COMMANDS.map((currentCommand) => {
              const noMissile =
                currentCommand.id === "attack" &&
                player.missiles <= 0;

              return (
                <motion.button
                  key={currentCommand.id}
                  disabled={
                    busy ||
                    noMissile ||
                    playerDefeated
                  }
                  whileTap={{
                    scale: 0.97,
                  }}
                  onClick={() =>
                    setCommand(currentCommand.id)
                  }
                  className={`command ${
                    command === currentCommand.id
                      ? "selected"
                      : ""
                  }`}
                >
                  <currentCommand.Icon size={22} />

                  <b>{currentCommand.label}</b>

                  <small>
                    {noMissile
                      ? "沒有可發射核彈"
                      : currentCommand.help}
                  </small>
                </motion.button>
              );
            })}
          </div>

          <button
            className="primary"
            disabled={
              busy ||
              playerDefeated ||
              Boolean(winner)
            }
            onClick={round}
          >
            {busy
              ? "各國正在行動…"
              : "送出命令"}
          </button>

          <div className="section-title log-title">
            <h2>
              <BookOpen size={20} />
              行動紀錄
            </h2>
          </div>

          <div className="logs">
            {logs.slice(0, 18).map((entry, index) => (
              <article key={`${entry.turn}-${index}`}>
                <div className="row sub">
                  <span>{entry.actor}</span>
                  <span>回合 {entry.turn}</span>
                </div>

                <p>{entry.text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {visual && (
          <motion.div
            className="overlay"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
          >
            <motion.div
              initial={{
                scale: 0.75,
              }}
              animate={{
                scale: 1,
              }}
              className="visual"
            >
              {visual.kind === "produce" && (
                <Factory size={90} />
              )}

              {visual.kind === "defend" && (
                <ShieldCheck size={90} />
              )}

              {visual.kind === "propaganda" && (
                <Radio size={90} />
              )}

              {visual.kind === "attack" && (
                <Crosshair size={90} />
              )}

              {visual.kind === "death" && (
                <Skull size={90} />
              )}

              <h2>
                {visual.kind === "death"
                  ? `${visual.actor}已滅亡`
                  : visual.blocked
                    ? "核彈遭攔截"
                    : visual.actor}
              </h2>

              {visual.to && (
                <p>目標：{visual.to}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {playerDefeated && (
        <motion.div
          className="overlay"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
        >
          <motion.div
            className="result"
            initial={{
              scale: 0.75,
              opacity: 0,
            }}
            animate={{
              scale: 1,
              opacity: 1,
            }}
          >
            <Skull size={90} />

            <h2>GAME OVER</h2>

            <p>
              曙光共和國人口已歸零。
              <br />
              戰局結束。
            </p>

            <button
              className="primary"
              onClick={reset}
            >
              <RotateCcw size={20} />
              返回開局設定
            </button>
          </motion.div>
        </motion.div>
      )}

      {winner && !playerDefeated && (
        <div className="overlay">
          <div className="result">
            <h2>戰局結束</h2>

            <p>
              {winner.name}成為最後存活國家。
            </p>

            <button
              className="primary"
              onClick={reset}
            >
              返回開局設定
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
