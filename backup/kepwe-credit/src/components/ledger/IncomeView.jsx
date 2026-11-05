import React from 'react';
import TransactionsView from './TransactionsView';

export default function IncomeView({ accounts, categories, onMutationSuccess }) {
  return (
    <TransactionsView
      accounts={accounts}
      categories={categories.filter((c) => c.type === 'income')}
      onMutationSuccess={onMutationSuccess}
      defaultType="income"
      title="Income Management"
      subtitle="Track customer receipts, sales revenue, consulting fees, and recurring cash inflows."
    />
  );
}
