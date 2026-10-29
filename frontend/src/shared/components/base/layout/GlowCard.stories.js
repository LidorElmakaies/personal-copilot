import Switch from '../form/Switch';
import GlowCard from './GlowCard';
import Row from './Row';

export default { component: GlowCard };

// The standard card: Rows, the last one without its border.
export const WithRows = {
  render: () => (
    <GlowCard>
      <Row
        title="Evening reminder"
        subtitle="21:00 · Anything to add today?"
        right={<Switch value onValueChange={() => {}} />}
      />
      <Row title="MAX ••4821" subtitle="Billing day: the 10th" last />
    </GlowCard>
  ),
};
