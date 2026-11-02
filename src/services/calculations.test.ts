import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatKwanza,
  parseKwanzaToCents,
  calculateAccountBalances,
  calculatePeriodSummary,
  calculateBudgetUtilization,
  executeTransferBalanceCheck,
  calculateGoalProgress,
} from './calculations';

test('formatKwanza formats integer cents to Portuguese/Angolan Kwanza currency', () => {
  assert.equal(formatKwanza(12500050), '125.000,50 Kz');
  assert.equal(formatKwanza(500000), '5.000,00 Kz');
  assert.equal(formatKwanza(0), '0,00 Kz');
  assert.equal(formatKwanza(-450000), '-4.500,00 Kz');
  assert.equal(formatKwanza(12500050, { masked: true }), '•••••••• Kz');
  assert.equal(formatKwanza(250000, { showSign: true }), '+2.500,00 Kz');
});

test('parseKwanzaToCents parses formatted strings safely without rounding errors', () => {
  assert.equal(parseKwanzaToCents('125.000,50'), 12500050);
  assert.equal(parseKwanzaToCents('50000 Kz'), 5000000);
  assert.equal(parseKwanzaToCents('45.000'), 4500000);
  assert.equal(parseKwanzaToCents('1,250.75'), 125075);
  assert.equal(parseKwanzaToCents('0,99'), 99);
  assert.equal(parseKwanzaToCents(500), 50000);
});

test('calculateAccountBalances correctly derives total, available and reserved savings', () => {
  const accounts = [
    { id: '1', type: 'bank', balanceCents: 50000000 }, // 500.000 Kz
    { id: '2', type: 'cash', balanceCents: 1500000 },  // 15.000 Kz
    { id: '3', type: 'wallet', balanceCents: 3500000 }, // 35.000 Kz
    { id: '4', type: 'savings', balanceCents: 20000000 }, // 200.000 Kz (reserved)
    { id: '5', type: 'bank', balanceCents: 10000000, isArchived: true }, // archived
  ];

  const result = calculateAccountBalances(accounts);
  assert.equal(result.totalBalanceCents, 75000000); // 500k + 15k + 35k + 200k = 750k
  assert.equal(result.reservedCents, 20000000); // 200k
  assert.equal(result.availableCents, 55000000); // 550k
});

test('calculatePeriodSummary ignores transfers in income/expense and calculates net', () => {
  const txs: any[] = [
    { id: '1', type: 'income', amountCents: 85000000, isPaid: true }, // Salary 850k
    { id: '2', type: 'expense', amountCents: 25000000, isPaid: true }, // Rent 250k
    { id: '3', type: 'expense', amountCents: 10000000, isPaid: true }, // Food 100k
    { id: '4', type: 'transfer', amountCents: 5000000, isPaid: true }, // Transfer 50k (neutral)
    { id: '5', type: 'expense', amountCents: 9000000, isPaid: false }, // Unpaid planned expense (ignored)
  ];

  const result = calculatePeriodSummary(txs);
  assert.equal(result.incomeCents, 85000000);
  assert.equal(result.expenseCents, 35000000); // 250k + 100k
  assert.equal(result.netBalanceCents, 50000000);
  // (850 - 350) / 850 = 500 / 850 ~ 59%
  assert.equal(result.savingsRatePercentage, 59);
});

test('calculateBudgetUtilization flags warning, danger and exceeded states accurately', () => {
  const limitCents = 10000000; // 100.000 Kz

  const normal = calculateBudgetUtilization(limitCents, 5000000); // 50%
  assert.equal(normal.percentage, 50);
  assert.equal(normal.status, 'normal');
  assert.equal(normal.remainingCents, 5000000);

  const warning = calculateBudgetUtilization(limitCents, 7800000); // 78%
  assert.equal(warning.status, 'warning');

  const danger = calculateBudgetUtilization(limitCents, 9200000); // 92%
  assert.equal(danger.status, 'danger');

  const exceeded = calculateBudgetUtilization(limitCents, 10500000); // 105%
  assert.equal(exceeded.percentage, 105);
  assert.equal(exceeded.isExceeded, true);
  assert.equal(exceeded.status, 'exceeded');
  assert.equal(exceeded.remainingCents, -500000);
});

test('executeTransferBalanceCheck ensures net total invariance across accounts', () => {
  const check = executeTransferBalanceCheck(10000000, 2000000, 3000000);
  assert.equal(check.newFromBalanceCents, 7000000);
  assert.equal(check.newToBalanceCents, 5000000);
  assert.equal(check.isTotalPreserved, true);
});

test('calculateGoalProgress calculates progress accurately', () => {
  const goal = calculateGoalProgress(2500000, 10000000);
  assert.equal(goal.percentage, 25);
  assert.equal(goal.remainingCents, 7500000);
  assert.equal(goal.isComplete, false);

  const completed = calculateGoalProgress(10000000, 10000000);
  assert.equal(completed.percentage, 100);
  assert.equal(completed.isComplete, true);
});
