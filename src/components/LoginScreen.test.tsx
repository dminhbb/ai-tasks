import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginScreen from '@/components/LoginScreen';

const signIn = vi.fn();

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ error: '', loading: false, signIn }),
}));

describe('LoginScreen', () => {
  beforeEach(() => signIn.mockReset());

  it('does not submit invalid credentials', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.type(screen.getByLabelText(/Email/i), 'invalid-email');
    await user.type(screen.getByLabelText(/password|khẩu/i), 'secret');
    const form = screen.getByRole('button').closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(signIn).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
