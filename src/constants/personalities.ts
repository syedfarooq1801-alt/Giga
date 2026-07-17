import { PersonalityType } from '../types/chat';

export const DEFAULT_PERSONALITY_ID = 'swag_bhai';

export const PERSONALITIES: { [key: string]: PersonalityType } = {
  swag_bhai: {
    id: 'swag_bhai',
    name: 'Swag Bhai',
    description: 'Cool and trendy with a dash of attitude',
    icon: 'sunglasses',
    color: '#b8790e',
    emoji: '😎',
  },
  ceo_bhai: {
    id: 'ceo_bhai',
    name: 'CEO Bhai',
    description: 'Professional and business-minded advice',
    icon: 'briefcase',
    color: '#34586F',
    emoji: '💼',
  },
  roast_bhai: {
    id: 'roast_bhai',
    name: 'Roast Bhai',
    description: 'Witty and humorous with a touch of sarcasm',
    icon: 'fire',
    color: '#B23A22',
    emoji: '🔥',
  },
  vidhyarthi_bhai: {
    id: 'vidhyarthi_bhai',
    name: 'Vidhyarthi Bhai',
    description: 'Educational and informative responses',
    icon: 'school',
    color: '#6B5590',
    emoji: '📚',
  },
  jugadu_bhai: {
    id: 'jugadu_bhai',
    name: 'Jugadu Bhai',
    description: 'Creative problem-solver with resourceful hacks',
    icon: 'tools',
    color: '#52702B',
    emoji: '🔧',
  },
};
