import React from 'react';
import TransactionsView from './TransactionsView';

export default function ExpensesView({ accounts, categories, onMutationSuccess }) {
  return (
    <TransactionsView
      accounts={accounts}
      categories={categories.filter((c) => c.type === 'expense')}
      onMutationSuccess={onMutationSuccess}
      defaultType="expense"
      title="Expenses Management"
      subtitle="Record and categorize operating costs, software subscriptions, office rent, and vendor payouts."
    />
  );
}
