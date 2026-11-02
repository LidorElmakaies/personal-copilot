import Switch from '../form/Switch';
import GlowCard from './GlowCard';
import Row from './Row';

export default { component: GlowCard, parameters: { language: 'en' } };

// The standard card: Rows, the last one without its border. The words are the story's own.
const Card = ({ evening, prompt, card, billing }) => (
  <GlowCard>
    <Row
      title={evening}
      subtitle={prompt}
      right={<Switch value onValueChange={() => {}} />}
    />
    <Row title={card} subtitle={billing} last />
  </GlowCard>
);

export const WithRows = {
  render: () => (
    <Card
      evening="Evening reminder"
      prompt="21:00 · Anything to add today?"
      card="MAX ••4821"
      billing="Billing day: the 10th"
    />
  ),
};

export const Hebrew = {
  parameters: { language: 'he' },
  render: () => (
    <Card
      evening="תזכורת ערב"
      prompt="21:00 · משהו להוסיף היום?"
      card="MAX ••4821"
      billing="יום חיוב: ה־10 בחודש"
    />
  ),
};
