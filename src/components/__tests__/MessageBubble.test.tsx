import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MessageBubble } from '../MessageBubble';

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      paper: '#faf8f5', surface: '#f1ede6', ink: '#1c1b18', sub: '#8a8377',
      line: 'rgba(0,0,0,0.08)', accent: '#b8790e', accentContrast: '#faf8f5',
      danger: '#c0392b', userMessageBackground: '#1c1b18', userMessageText: '#faf8f5',
      botMessageBackground: '#f1ede6', botMessageText: '#1c1b18',
    },
    isDark: false,
    radius: { sm: 8, md: 14, lg: 16, pill: 999 },
    typography: { fontFamily: 'System', monoFontFamily: 'monospace' },
  }),
}));

describe('MessageBubble', () => {
  it('renders assistant text with markdown code formatting', () => {
    const { getByText } = render(
      <MessageBubble text={'here is `some code`'} sender="assistant" />
    );
    expect(getByText('some code')).toBeTruthy();
  });

  it('renders plain user text without markdown parsing', () => {
    const { getByText } = render(
      <MessageBubble text={'plain *not markdown* text'} sender="user" />
    );
    expect(getByText('plain *not markdown* text')).toBeTruthy();
  });

  it('calls onReact with the right flags when thumbs-up is pressed', () => {
    const onReact = jest.fn();
    const { getByTestId } = render(
      <MessageBubble text="a reply" sender="assistant" onReact={onReact} reactions={null} />
    );
    fireEvent.press(getByTestId('reaction-thumbs-up'));
    expect(onReact).toHaveBeenCalledWith(true, false);
  });

  it('calls onReact with the right flags when thumbs-down is pressed', () => {
    const onReact = jest.fn();
    const { getByTestId } = render(
      <MessageBubble text="a reply" sender="assistant" onReact={onReact} reactions={null} />
    );
    fireEvent.press(getByTestId('reaction-thumbs-down'));
    expect(onReact).toHaveBeenCalledWith(false, true);
  });

  it('shows a regenerate control only on the last assistant message', () => {
    const onRegenerate = jest.fn();
    const { rerender, queryByTestId } = render(
      <MessageBubble text="reply" sender="assistant" isLastAssistantMessage={false} onRegenerate={onRegenerate} />
    );
    expect(queryByTestId('regenerate-button')).toBeNull();

    rerender(
      <MessageBubble text="reply" sender="assistant" isLastAssistantMessage={true} onRegenerate={onRegenerate} />
    );
    const regenerateButton = queryByTestId('regenerate-button');
    expect(regenerateButton).toBeTruthy();
    fireEvent.press(regenerateButton!);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });
});
