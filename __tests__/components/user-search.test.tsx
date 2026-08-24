import { describe, it, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { UserSearch } from '@/app/(admin)/admin/components/user-search';
import {
  LIFECYCLE_EMAIL_TYPE_NO_BOARD,
  LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE,
} from '@/lib/constants';

const templateOptions = [
  { key: LIFECYCLE_EMAIL_TYPE_NO_BOARD, label: 'No board yet (25% off)', hasDiscount: true },
  { key: LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE, label: 'Board but no cards', hasDiscount: false },
];

const users = [
  {
    id: 'u1',
    email: 'never@example.com',
    name: 'Never Started',
    boardCount: 0,
    cardCount: 0,
    paidBoardCount: 0,
    createdAt: '2026-01-02T00:00:00.000Z',
    sentEmails: [],
  },
  {
    id: 'u2',
    email: 'active@example.com',
    name: 'Has Board',
    boardCount: 2,
    cardCount: 9,
    paidBoardCount: 1,
    createdAt: '2026-01-03T00:00:00.000Z',
    sentEmails: [],
  },
  {
    id: 'u3',
    email: 'alsonever@example.com',
    name: 'Also Never',
    boardCount: 0,
    cardCount: 0,
    paidBoardCount: 0,
    createdAt: '2026-01-04T00:00:00.000Z',
    sentEmails: [],
  },
  {
    id: 'u4',
    email: 'stalled@example.com',
    name: 'Board No Cards',
    boardCount: 1,
    cardCount: 0,
    paidBoardCount: 0,
    createdAt: '2026-01-05T00:00:00.000Z',
    sentEmails: [],
  },
];

function renderTable() {
  return render(<UserSearch users={users} templateOptions={templateOptions} />);
}

const noBoardsToggle = () => screen.getByRole('button', { name: /^no boards/i });
const noCardsToggle = () => screen.getByRole('button', { name: /^board, no cards/i });

describe('UserSearch — no-boards filter', () => {
  it('counts the no-board audience on the toggle before it is applied', () => {
    renderTable();
    expect(noBoardsToggle()).toHaveTextContent('2');
    expect(noBoardsToggle()).toHaveAttribute('aria-pressed', 'false');
  });

  it('narrows the table to users with zero boards', () => {
    renderTable();
    expect(screen.getByText('active@example.com')).toBeInTheDocument();

    fireEvent.click(noBoardsToggle());

    expect(noBoardsToggle()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('never@example.com')).toBeInTheDocument();
    expect(screen.getByText('alsonever@example.com')).toBeInTheDocument();
    expect(screen.queryByText('active@example.com')).toBeNull();
  });

  it('keeps the count stable once the filter narrows the table', () => {
    renderTable();
    fireEvent.click(noBoardsToggle());
    expect(noBoardsToggle()).toHaveTextContent('2');
  });

  it('select-all picks exactly the filtered audience, not the whole user list', () => {
    renderTable();
    fireEvent.click(noBoardsToggle());
    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }));

    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('composes with the search box rather than replacing it', () => {
    renderTable();
    fireEvent.click(noBoardsToggle());
    fireEvent.change(screen.getByPlaceholderText(/search by email or name/i), {
      target: { value: 'alsonever' },
    });

    expect(screen.getByText('alsonever@example.com')).toBeInTheDocument();
    expect(screen.queryByText('never@example.com')).toBeNull();
  });

  it('explains an empty result as a filter effect, not "no users"', () => {
    render(<UserSearch users={[users[1]]} templateOptions={templateOptions} />);
    fireEvent.click(noBoardsToggle());

    const table = screen.getByRole('table');
    expect(within(table).getByText('No users without a board')).toBeInTheDocument();
  });

  it('toggles back off and restores the full list', () => {
    renderTable();
    fireEvent.click(noBoardsToggle());
    fireEvent.click(noBoardsToggle());

    expect(screen.getByText('active@example.com')).toBeInTheDocument();
    expect(noBoardsToggle()).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('UserSearch — board-but-no-cards filter', () => {
  it('counts only users who have a board and zero cards', () => {
    renderTable();
    expect(noCardsToggle()).toHaveTextContent('1');
  });

  it('excludes users with no board at all — that is the other campaign', () => {
    renderTable();
    fireEvent.click(noCardsToggle());

    expect(screen.getByText('stalled@example.com')).toBeInTheDocument();
    expect(screen.queryByText('never@example.com')).toBeNull();
    expect(screen.queryByText('active@example.com')).toBeNull();
  });

  it('is mutually exclusive with the no-boards filter', () => {
    renderTable();
    fireEvent.click(noBoardsToggle());
    fireEvent.click(noCardsToggle());

    expect(noBoardsToggle()).toHaveAttribute('aria-pressed', 'false');
    expect(noCardsToggle()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('stalled@example.com')).toBeInTheDocument();
    expect(screen.queryByText('never@example.com')).toBeNull();
  });

  it('names the filter in its own empty state', () => {
    render(<UserSearch users={[users[1]]} templateOptions={templateOptions} />);
    fireEvent.click(noCardsToggle());

    const table = screen.getByRole('table');
    expect(within(table).getByText('No users with a board and no cards')).toBeInTheDocument();
  });
});
