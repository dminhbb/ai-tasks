import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AccessErrorScreen from '@/components/AccessErrorScreen';

describe('AccessErrorScreen', () => {
  it('shows the access error with a warning icon and top bar', () => {
    render(<AccessErrorScreen message="Lỗi: Chưa được phân quyền vào Space" onSignOut={vi.fn()} />);
    expect(screen.getByText('AI TASK')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Lỗi: Chưa được phân quyền vào Space');
  });
});
