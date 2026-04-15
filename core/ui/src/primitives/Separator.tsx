import type { CSSProperties, FC } from 'react';

const style: CSSProperties = {
  height: 1,
  margin: '4px 0',
  background: 'rgba(127,127,127,0.25)',
  border: 'none',
};

export const Separator: FC = () => <hr style={style} />;
