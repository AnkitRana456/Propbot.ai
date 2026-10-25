import React, { useMemo } from 'react';
import { Billboard, Box, Emoji, GableRoof, Group, Island, Shadow, SignPost, Tree, WindowGrid, staticStates } from './Models3D.js';

/** The four kinds of property PropBot sells: a villa, a plot of land, an apartment block and a shop. */

interface ModelProps {
  sold: boolean;
}

// ───────────────────────────── villa

export const VillaModel: React.FC<ModelProps> = ({ sold }) => (
  <>
    <Island r={172} />
    <Shadow r={96} z={-4} />

    {/* walls */}
    <Box
      w={130}
      h={62}
      d={92}
      z={-8}
      tone="var(--m3d-wall-warm)"
      top={false}
      faces={{
        front: (
          <>
            <span className="m3d-door" style={{ left: 54, top: 28, width: 22, height: 34 }} />
            <span className="m3d-pane" style={{ left: 14, top: 18, width: 28, height: 24 }} />
            <span className="m3d-pane" style={{ left: 88, top: 18, width: 28, height: 24 }} />
          </>
        ),
        right: <span className="m3d-pane" style={{ left: 33, top: 18, width: 26, height: 24 }} />,
        left: <span className="m3d-pane" style={{ left: 33, top: 18, width: 26, height: 24 }} />,
        back: (
          <>
            <span className="m3d-pane" style={{ left: 22, top: 18, width: 28, height: 24 }} />
            <span className="m3d-pane" style={{ left: 80, top: 18, width: 28, height: 24 }} />
          </>
        ),
      }}
    />
    <GableRoof w={130} d={92} y={62} z={-8} rise={42} />
    <Box w={12} h={36} d={12} x={36} y={58} z={-30} tone="var(--m3d-roof-lo)" />

    {/* porch */}
    <Box w={46} h={4} d={24} z={50} tone="var(--m3d-concrete)" />
    <Box w={5} h={32} d={5} x={-19} y={4} z={59} tone="var(--m3d-wall)" top={false} />
    <Box w={5} h={32} d={5} x={19} y={4} z={59} tone="var(--m3d-wall)" top={false} />
    <Box w={54} h={4} d={30} y={36} z={52} tone="var(--m3d-roof-lo)" />

    {/* path, garden and sign */}
    <Box w={18} h={1.5} d={62} z={104} tone="var(--m3d-path)" />
    <Tree x={-112} z={34} />
    <Tree x={-92} z={-62} s={0.9} />
    <Tree x={120} z={-44} s={1.1} pine />
    <Tree x={128} z={42} s={0.9} pine />
    <SignPost x={64} z={112} sold={sold} />

    <Billboard y={166} z={-8} bob>
      <Emoji>🔑</Emoji>
    </Billboard>
  </>
);

// ───────────────────────────── plot of land

export const PlotModel: React.FC<ModelProps> = ({ sold }) => (
  <Group s={1.16}>
    <Island r={196} />
    <Shadow r={150} />

    {/* the plot, with survey lines and its number written on the ground */}
    <Box
      w={230}
      h={10}
      d={156}
      tone="var(--m3d-soil)"
      faceClass={{ top: 'm3d-survey' }}
      faces={{
        top: (
          <>
            <div className="m3d-plan">
              <strong>Plot 24</strong>
              <span>1,200 sq ft</span>
            </div>
            <span className="m3d-dim" style={{ left: '50%', bottom: 5, transform: 'translateX(-50%)' }}>40 ft</span>
            <span className="m3d-dim" style={{ left: 6, top: '50%', transform: 'translateY(-50%)', writingMode: 'vertical-rl' }}>30 ft</span>
          </>
        ),
      }}
    />

    {/* corner stakes with a rope between them */}
    {[-1, 1].flatMap(sx => [-1, 1].map(sz => ({ sx, sz }))).map(({ sx, sz }) => (
      <React.Fragment key={`${sx}${sz}`}>
        <Box w={5} h={36} d={5} x={sx * 108} y={10} z={sz * 72} tone="var(--m3d-trunk)" top={false} />
        <Box w={9} h={6} d={9} x={sx * 108} y={40} z={sz * 72} tone="var(--brass)" />
      </React.Fragment>
    ))}
    {[-1, 1].map(sz => (
      <Box key={`rope-x${sz}`} w={216} h={1.5} d={1.5} y={32} z={sz * 72} tone="var(--brass)" />
    ))}
    {[-1, 1].map(sx => (
      <Box key={`rope-z${sx}`} w={1.5} h={1.5} d={144} x={sx * 108} y={32} tone="var(--brass)" />
    ))}

    {/* first walls going up, so you can see what the land becomes */}
    <Box w={104} h={9} d={4} y={10} z={30} tone="var(--m3d-concrete)" />
    <Box w={104} h={9} d={4} y={10} z={-30} tone="var(--m3d-concrete)" />
    <Box w={4} h={9} d={56} x={-50} y={10} tone="var(--m3d-concrete)" />
    <Box w={4} h={9} d={56} x={50} y={10} tone="var(--m3d-concrete)" />
    {[-1, 1].flatMap(sx => [-1, 1].map(sz => ({ sx, sz }))).map(({ sx, sz }) => (
      <Box key={`bar${sx}${sz}`} w={3} h={26} d={3} x={sx * 50} y={19} z={sz * 30} tone="var(--m3d-door)" top={false} />
    ))}

    <Tree x={-150} z={-100} pine s={1.1} />
    <Tree x={152} z={-96} s={1} />
    <Tree x={166} z={62} pine s={0.9} />
    <SignPost x={-100} z={108} sold={sold} />

    <Billboard y={112} bob>
      <Emoji>📍</Emoji>
    </Billboard>
  </Group>
);

// ───────────────────────────── apartment block

const FLOOR = 22;
const APT_FLOORS = 10;

export const ApartmentModel: React.FC<ModelProps> = ({ sold }) => {
  const states = useMemo(() => staticStates(3 * APT_FLOORS * 4, 41), []);
  const per = 3 * APT_FLOORS;
  const h = APT_FLOORS * FLOOR;
  const grid = (n: number) => <WindowGrid states={states} offset={per * n} cols={3} floors={APT_FLOORS} gap="6px 7px" pad="9px 10px" />;
  return (
    <>
      <Island r={172} />
      <Shadow r={120} />
      <Box w={176} h={9} d={150} tone="var(--m3d-concrete)" />
      <Box w={100} h={h} d={100} y={9} tone="var(--m3d-wall)" faces={{ front: grid(0), back: grid(1), right: grid(2), left: grid(3) }} />
      {[2, 4, 6, 8, 10].map(f => (
        <Box key={f} w={100} h={3} d={12} y={9 + f * FLOOR - 2} z={56} tone="var(--m3d-concrete)" />
      ))}
      {/* roof: water tank, antenna and a blinking light */}
      <Box w={28} h={16} d={28} x={-22} y={9 + h} z={-14} tone="var(--m3d-concrete)" />
      <Box w={3} h={46} d={3} x={26} y={9 + h} z={18} tone="var(--m3d-concrete)" top={false} />
      <Box w={7} h={7} d={7} x={26} y={9 + h + 46} z={18} tone="#ff5a5a" className="m3d-led" />
      <Tree x={-122} z={60} pine />
      <Tree x={124} z={-44} s={0.9} />
      <Tree x={118} z={64} pine s={0.8} />
      <SignPost x={-96} z={104} sold={sold} />
      <Billboard y={9 + h + 78} bob>
        <Emoji>⭐</Emoji>
      </Billboard>
    </>
  );
};

// ───────────────────────────── shop

export const ShopModel: React.FC<ModelProps> = ({ sold }) => (
  <>
    <Island r={172} />
    <Shadow r={120} />
    <Box w={170} h={5} d={116} tone="var(--m3d-path)" />
    <Box
      w={150}
      h={84}
      d={100}
      y={5}
      tone="var(--m3d-concrete)"
      faceClass={{ front: 'm3d-glass-face', back: 'm3d-glass-face', left: 'm3d-glass-face', right: 'm3d-glass-face' }}
      faces={{
        front: (
          <>
            <span className="m3d-pane" style={{ left: 14, bottom: 6, width: 44, height: 24 }} />
            <span className="m3d-pane" style={{ right: 14, bottom: 6, width: 44, height: 24 }} />
            <span className="m3d-door" style={{ left: 63, bottom: 0, width: 24, height: 32 }} />
          </>
        ),
      }}
    />
    {/* striped awning over the entrance */}
    <Box w={140} h={3} d={24} y={42} z={60} tone="var(--accent)" faceClass={{ top: 'm3d-stripes' }} />
    {/* roof */}
    <Box w={150} h={4} d={100} y={89} tone="var(--m3d-concrete)" />
    <Box w={26} h={13} d={22} x={-44} y={93} z={-18} tone="var(--m3d-wall)" />
    <Box w={26} h={13} d={22} x={-8} y={93} z={-18} tone="var(--m3d-wall)" />
    <Box
      w={112}
      h={18}
      d={6}
      y={93}
      z={44}
      tone="var(--accent)"
      faces={{ front: <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', font: '800 11px var(--font-sans)', letterSpacing: '0.08em', color: 'var(--on-accent)' }}>SKYLINE PLAZA</span> }}
    />
    <Tree x={-122} z={50} pine />
    <Tree x={126} z={-52} s={0.9} />
    <SignPost x={-84} z={100} sold={sold} labels={['TO LET', 'LEASED']} />
    <Billboard y={9 + 112} bob>
      <Emoji>🛍️</Emoji>
    </Billboard>
  </>
);
