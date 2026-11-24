import { useState } from 'react';
import { PASTE_SAMPLE, STATEMENT_CARDS } from '../mocks';
import CardChips from './CardChips';
import StatementSource from './StatementSource';

// Choose file… picks an example one, here only.
const Source = ({ fileName, withCards, ...args }) => {
  const [file, setFile] = useState(fileName ? { name: fileName } : null);
  const [card, setCard] = useState(STATEMENT_CARDS[0].last4);
  return (
    <StatementSource
      card={card}
      {...args}
      header={
        withCards && (
          <CardChips cards={STATEMENT_CARDS} value={card} onChange={setCard} />
        )
      }
      file={file}
      onChooseFile={() => setFile({ name: 'MAX-October-2026.xlsx' })}
    />
  );
};

export default {
  component: StatementSource,
  parameters: { layout: 'fullscreen', language: 'en' },
  render: (args) => <Source {...args} />,
  args: { issuer: 'MAX' },
  argTypes: { onCheck: { action: 'check' } },
};

export const File = {};
export const FileChosen = { args: { fileName: 'MAX-October-2026.xlsx' } };
// A card whose company isn't known.
export const AnyIssuer = { args: { issuer: undefined } };
// Check says a card is missing.
export const NoCard = { args: { card: null } };
export const Paste = { args: { defaultSource: 'text' } };
export const Pasted = {
  args: { defaultSource: 'text', defaultText: PASTE_SAMPLE },
};
export const LongPaste = {
  args: {
    defaultSource: 'text',
    defaultText: Array(20).fill(PASTE_SAMPLE).join('\n'),
    withCards: true,
  },
};
export const Hebrew = { parameters: { language: 'he' } };
export const HebrewPasted = {
  parameters: { language: 'he' },
  args: { defaultSource: 'text', defaultText: PASTE_SAMPLE, withCards: true },
};
