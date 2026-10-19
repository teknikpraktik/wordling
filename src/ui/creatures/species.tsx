import type { SpeciesInfo } from '../../domain/creatures';
import type { Stage } from '../../domain/types';
import { Cheeks, Eyes, Mouth, Star, type Mood, INK } from './parts';

interface P {
  pal: SpeciesInfo['palette'];
  stage: Stage;
  mood: Mood;
}

/* Moffi – mint cloud-bunny with long ears that wiggle */
export function Moffi({ pal, stage, mood }: P) {
  const len = stage === 1 ? 20 : stage === 2 ? 30 : 36;
  const ear = (cx: number, rot: number, cls: string) => (
    <g className={`ear ${cls}`} transform={`rotate(${rot} ${cx} 90)`}>
      <ellipse cx={cx} cy={90 - len} rx={11.5} ry={len} fill={pal.main} />
      <ellipse cx={cx} cy={92 - len} rx={5.5} ry={len * 0.66} fill={pal.accent} opacity="0.9" />
      {stage === 3 && <Star cx={cx} cy={90 - len * 2 + 4} r={8} fill="#FFE08A" />}
    </g>
  );
  return (
    <g>
      <circle className="tail-puff" cx={stage === 1 ? 148 : 154} cy={150} r={stage === 1 ? 10 : 14} fill={pal.light} />
      {ear(76, -10, 'ear-l')}
      {ear(124, 10, 'ear-r')}
      <circle cx={56} cy={142} r={16} fill={pal.main} />
      <circle cx={144} cy={142} r={16} fill={pal.main} />
      <ellipse cx={100} cy={128} rx={54} ry={48} fill={pal.main} />
      <ellipse cx={100} cy={144} rx={34} ry={28} fill={pal.light} />
      <ellipse cx={80} cy={177} rx={15} ry={7} fill={pal.dark} />
      <ellipse cx={120} cy={177} rx={15} ry={7} fill={pal.dark} />
      <Cheeks x={100} y={130} gap={28} />
      <Eyes x={100} y={118} gap={20} mood={mood} />
      <Mouth x={100} y={129} mood={mood} />
      {stage === 1 && <path d="M100 82 q-6 -12 4 -14" stroke={pal.dark} strokeWidth="3.5" strokeLinecap="round" fill="none" />}
      {stage === 2 && <ellipse cx={100} cy={80} rx={7} ry={4} fill="#8FD9A8" transform="rotate(-25 100 80)" />}
      {stage === 3 && (
        <g>
          <circle cx={100} cy={80} r={6} fill="#FFE08A" />
          <circle cx={86} cy={85} r={5} fill={pal.accent} />
          <circle cx={114} cy={85} r={5} fill="#fff" />
          <circle cx={100} cy={80} r={2.4} fill={pal.accent} />
        </g>
      )}
    </g>
  );
}

/* Tuffa – lavender owl with flapping wings */
export function Tuffa({ pal, stage, mood }: P) {
  const tuft = stage === 1 ? 10 : stage === 2 ? 20 : 26;
  const wingL =
    stage === 3
      ? 'M56 118 Q6 86 10 150 Q28 140 32 158 Q42 142 54 152 Z'
      : `M58 112 Q${stage === 2 ? 28 : 38} 118 40 ${stage === 2 ? 150 : 142} Q54 146 60 134 Z`;
  const wingR =
    stage === 3
      ? 'M144 118 Q194 86 190 150 Q172 140 168 158 Q158 142 146 152 Z'
      : `M142 112 Q${stage === 2 ? 172 : 162} 118 160 ${stage === 2 ? 150 : 142} Q146 146 140 134 Z`;
  return (
    <g>
      <path className="wing wing-l" d={wingL} fill={pal.dark} />
      <path className="wing wing-r" d={wingR} fill={pal.dark} />
      <path d={`M66 92 L${56} ${92 - tuft} L88 80 Z`} fill={pal.dark} strokeLinejoin="round" />
      <path d={`M134 92 L${144} ${92 - tuft} L112 80 Z`} fill={pal.dark} strokeLinejoin="round" />
      <ellipse cx={100} cy={124} rx={50} ry={54} fill={pal.main} />
      <ellipse cx={100} cy={142} rx={32} ry={32} fill={pal.light} />
      {stage >= 2 && (
        <g stroke={pal.dark} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.5">
          <path d="M88 140 q4 5 8 0" />
          <path d="M104 140 q4 5 8 0" />
          <path d="M96 152 q4 5 8 0" />
        </g>
      )}
      <circle cx={80} cy={112} r={17} fill="#fff" />
      <circle cx={120} cy={112} r={17} fill="#fff" />
      <Eyes x={100} y={113} gap={20} r={8} mood={mood} />
      <path d="M94 124 L106 124 L100 135 Z" fill={pal.accent} stroke="#E9B94A" strokeWidth="1" strokeLinejoin="round" />
      <Cheeks x={100} y={128} gap={36} rx={6} ry={4} />
      <ellipse cx={86} cy={178} rx={11} ry={5} fill={pal.accent} />
      <ellipse cx={114} cy={178} rx={11} ry={5} fill={pal.accent} />
      {stage === 3 && (
        <g>
          <path d="M100 76 L94 54 L100 62 L106 54 Z" fill={pal.accent} stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M88 80 L76 62 L90 68 Z" fill={pal.accent} />
          <path d="M112 80 L124 62 L110 68 Z" fill={pal.accent} />
        </g>
      )}
    </g>
  );
}

/* Fenna – peach fox-cat with swishing tails (three when evolved) */
export function Fenna({ pal, stage, mood }: P) {
  const tail = 'M138 158 C190 158 194 108 166 90 C172 122 150 134 130 136 Z';
  const tails =
    stage === 3 ? [-24, 0, 24] : [0];
  const s = stage === 1 ? 0.75 : 1;
  return (
    <g>
      <g className="tail" style={{ transformOrigin: '136px 150px' }}>
        {tails.map((rot) => (
          <g key={rot} transform={`rotate(${rot} 136 150) translate(136 150) scale(${s}) translate(-136 -150)`}>
            <path d={tail} fill={pal.main} />
            <circle cx={166} cy={93} r={9} fill="#fff" />
          </g>
        ))}
      </g>
      <ellipse cx={100} cy={148} rx={40} ry={32} fill={pal.main} />
      <ellipse cx={100} cy={158} rx={22} ry={20} fill="#fff" opacity="0.9" />
      <ellipse cx={82} cy={177} rx={11} ry={6} fill={pal.light} />
      <ellipse cx={118} cy={177} rx={11} ry={6} fill={pal.light} />
      <g className="ear ear-l">
        <path d="M58 88 L54 50 L90 72 Z" fill={pal.main} strokeLinejoin="round" />
        <path d="M63 80 L61 60 L80 72 Z" fill={pal.light} />
      </g>
      <g className="ear ear-r">
        <path d="M142 88 L146 50 L110 72 Z" fill={pal.main} strokeLinejoin="round" />
        <path d="M137 80 L139 60 L120 72 Z" fill={pal.light} />
      </g>
      <ellipse cx={100} cy={106} rx={48} ry={40} fill={pal.main} />
      <path d="M54 112 L38 116 L54 126 Z" fill={pal.main} />
      <path d="M146 112 L162 116 L146 126 Z" fill={pal.main} />
      <ellipse cx={100} cy={120} rx={22} ry={15} fill="#fff" opacity="0.92" />
      <Eyes x={100} y={104} gap={22} mood={mood} />
      <ellipse cx={100} cy={113} rx={3.6} ry={2.6} fill="#E58A8A" />
      <Mouth x={100} y={116} mood={mood} w={5} />
      <Cheeks x={100} y={118} gap={36} rx={6} ry={4} />
      <g stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity="0.35">
        <path d="M70 118 L52 114" />
        <path d="M70 122 L52 124" />
        <path d="M130 118 L148 114" />
        <path d="M130 122 L148 124" />
      </g>
      {stage === 3 && <path d="M100 76 l5 7 l-5 7 l-5 -7 Z" fill="#FFD76A" stroke="#fff" strokeWidth="1.2" />}
      {stage === 2 && <circle cx={100} cy={80} r={3} fill={pal.dark} />}
    </g>
  );
}

/* Glimmo – tiny yellow dragon with fluttering wings */
export function Glimmo({ pal, stage, mood }: P) {
  const wingL =
    stage === 1
      ? 'M62 112 Q42 100 44 124 Q54 122 62 128 Z'
      : stage === 2
        ? 'M62 108 Q28 82 24 118 Q40 118 44 134 Q54 124 64 130 Z'
        : 'M64 106 Q18 52 10 104 Q28 102 30 124 Q44 112 52 136 Q60 124 66 132 Z';
  const wingR =
    stage === 1
      ? 'M138 112 Q158 100 156 124 Q146 122 138 128 Z'
      : stage === 2
        ? 'M138 108 Q172 82 176 118 Q160 118 156 134 Q146 124 136 130 Z'
        : 'M136 106 Q182 52 190 104 Q172 102 170 124 Q156 112 148 136 Q140 124 134 132 Z';
  return (
    <g>
      <g className="tail" style={{ transformOrigin: '138px 160px' }}>
        <path d="M136 162 Q186 172 178 128 Q168 152 138 148 Z" fill={pal.main} />
        <path d="M178 118 l9 12 l-9 12 l-9 -12 Z" fill={pal.accent} transform="translate(0 -2)" />
      </g>
      <path className="wing wing-l" d={wingL} fill={stage === 3 ? pal.accent : pal.dark} opacity={stage === 3 ? 0.9 : 1} />
      <path className="wing wing-r" d={wingR} fill={stage === 3 ? pal.accent : pal.dark} opacity={stage === 3 ? 0.9 : 1} />
      <ellipse cx={100} cy={128} rx={46} ry={44} fill={pal.main} />
      <ellipse cx={100} cy={146} rx={28} ry={26} fill={pal.light} />
      <g stroke={pal.dark} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.45">
        <path d="M84 140 Q100 146 116 140" />
        <path d="M82 150 Q100 156 118 150" />
        <path d="M86 160 Q100 165 114 160" />
      </g>
      <path d="M74 92 L64 66 L90 82 Z" fill={pal.accent} strokeLinejoin="round" />
      <path d="M126 92 L136 66 L110 82 Z" fill={pal.accent} strokeLinejoin="round" />
      <g fill={pal.dark} opacity="0.85">
        <path d="M92 84 L100 70 L108 84 Z" />
        {stage >= 2 && <path d="M80 88 L86 78 L92 88 Z" />}
        {stage >= 2 && <path d="M108 88 L114 78 L120 88 Z" />}
      </g>
      <ellipse cx={58} cy={140} rx={9} ry={11} fill={pal.main} />
      <ellipse cx={142} cy={140} rx={9} ry={11} fill={pal.main} />
      <ellipse cx={80} cy={177} rx={14} ry={7} fill={pal.dark} />
      <ellipse cx={120} cy={177} rx={14} ry={7} fill={pal.dark} />
      <Cheeks x={100} y={126} gap={30} />
      <Eyes x={100} y={114} gap={21} mood={mood} />
      <g fill={pal.dark} opacity="0.7">
        <circle cx={95} cy={123} r={1.8} />
        <circle cx={105} cy={123} r={1.8} />
      </g>
      <Mouth x={100} y={129} mood={mood} />
      {stage === 3 && <Star cx={100} cy={64} r={7} fill="#fff" />}
    </g>
  );
}

/* Nuffa – aqua snail-friend with a swirly shell */
export function Nuffa({ pal, stage, mood }: P) {
  const r = stage === 1 ? 32 : stage === 2 ? 40 : 45;
  const cx = 124;
  const cy = 156 - r;
  return (
    <g>
      <ellipse cx={100} cy={164} rx={74} ry={20} fill={pal.dark} opacity="0.55" />
      <ellipse cx={104} cy={160} rx={72} ry={20} fill={pal.main} />
      <g className="shell">
        <circle cx={cx} cy={cy} r={r} fill={pal.accent} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fff" strokeWidth="2" opacity="0.5" />
        <path
          d={`M${cx} ${cy} a${r * 0.16} ${r * 0.16} 0 1 1 ${r * 0.32} 0 a${r * 0.32} ${r * 0.32} 0 1 1 ${-r * 0.64} 0 a${r * 0.5} ${r * 0.5} 0 1 1 ${r} 0`}
          stroke="#fff"
          strokeWidth="4.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
        {stage === 3 && (
          <g fill="#CFF3FF" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round">
            <path d={`M${cx - 10} ${cy - r + 4} L${cx - 14} ${cy - r - 16} L${cx - 2} ${cy - r + 2} Z`} />
            <path d={`M${cx + 2} ${cy - r + 1} L${cx + 6} ${cy - r - 22} L${cx + 14} ${cy - r + 4} Z`} />
            <path d={`M${cx + 14} ${cy - r + 6} L${cx + 26} ${cy - r - 10} L${cx + 26} ${cy - r + 12} Z`} />
          </g>
        )}
      </g>
      <circle cx={58} cy={134} r={stage === 1 ? 31 : 33} fill={pal.main} />
      <g className="antennae" stroke={pal.dark} strokeWidth="3" strokeLinecap="round" fill="none">
        <path className="ant ant-l" d="M46 108 Q36 90 40 76" />
        <path className="ant ant-r" d="M70 106 Q78 88 76 74" />
      </g>
      <circle cx={40} cy={74} r={5.5} fill={pal.accent} />
      <circle cx={76} cy={72} r={5.5} fill={pal.accent} />
      <Cheeks x={58} y={142} gap={19} rx={6} ry={4} />
      <Eyes x={58} y={130} gap={13} r={5.8} mood={mood} />
      <Mouth x={58} y={141} mood={mood} w={5} />
    </g>
  );
}

/* Lumi – dreamy floating light-sprite */
export function Lumi({ pal, stage, mood }: P) {
  const skirt =
    'M50 104 Q50 54 100 54 Q150 54 150 104 L150 134 Q141 152 132 134 Q124 152 116 134 Q108 154 100 134 Q92 154 84 134 Q76 152 68 134 Q59 152 50 134 Z';
  return (
    <g className="float-body" transform="translate(0 16)">
      {stage >= 2 && (
        <g stroke={pal.main} strokeWidth={stage === 3 ? 9 : 8} strokeLinecap="round" fill="none">
          <path className="ribbon r1" d={`M70 140 Q58 ${stage === 3 ? 164 : 156} 70 ${stage === 3 ? 176 : 164}`} />
          <path className="ribbon r2" d={`M130 140 Q142 ${stage === 3 ? 164 : 156} 130 ${stage === 3 ? 176 : 164}`} />
          {stage === 3 && <path className="ribbon r3" d="M100 144 Q92 166 102 178" />}
        </g>
      )}
      <path d={skirt} fill={pal.main} />
      <ellipse cx={100} cy={96} rx={36} ry={27} fill={pal.light} opacity="0.65" />
      <ellipse className="arm arm-l" cx={46} cy={114} rx={8} ry={11} fill={pal.main} transform="rotate(25 46 114)" />
      <ellipse className="arm arm-r" cx={154} cy={114} rx={8} ry={11} fill={pal.main} transform="rotate(-25 154 114)" />
      <Cheeks x={100} y={112} gap={28} />
      <Eyes x={100} y={100} gap={19} mood={mood} />
      <Mouth x={100} y={112} mood={mood} />
      {stage === 1 && <circle className="glow" cx={100} cy={46} r={4.5} fill={pal.accent} />}
      {stage >= 2 && (
        <g>
          <path d="M100 56 L100 38" stroke={pal.dark} strokeWidth="3" strokeLinecap="round" />
          <g className="glow">
            <Star cx={100} cy={32} r={stage === 3 ? 9 : 7} fill={pal.accent} />
          </g>
        </g>
      )}
      {stage === 3 && (
        <g>
          <ellipse cx={100} cy={28} rx={30} ry={9} fill="none" stroke={pal.accent} strokeWidth="4" opacity="0.9" />
          <path d="M156 70 a14 14 0 1 0 8 22 a11 11 0 1 1 -8 -22 Z" fill={pal.accent} stroke="#fff" strokeWidth="1.2" />
          <Star cx={40} cy={64} r={5} fill="#fff" />
        </g>
      )}
    </g>
  );
}

export const SPECIES_ART = { moffi: Moffi, tuffa: Tuffa, fenna: Fenna, glimmo: Glimmo, nuffa: Nuffa, lumi: Lumi } as const;
