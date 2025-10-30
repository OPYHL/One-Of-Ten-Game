export const AVATAR_CATALOG = {
  'male-analyst': {
    label: 'Analityk',
    gender: 'MALE',
    images: {
      idle: '/img/avatar-male-analyst.svg',
      knowing: '/img/avatar-male-analyst.svg',
      success: '/img/avatar-male-analyst.svg',
      wrong: '/img/avatar-male-analyst.svg',
    },
  },
  'male-innovator': {
    label: 'Twórca',
    gender: 'MALE',
    images: {
      idle: '/img/avatar-male-innovator.svg',
      knowing: '/img/avatar-male-innovator.svg',
      success: '/img/avatar-male-innovator.svg',
      wrong: '/img/avatar-male-innovator.svg',
    },
  },
  'male-leader': {
    label: 'Lider',
    gender: 'MALE',
    images: {
      idle: '/img/avatar-male-leader.svg',
      knowing: '/img/avatar-male-leader.svg',
      success: '/img/avatar-male-leader.svg',
      wrong: '/img/avatar-male-leader.svg',
    },
  },
  'female-mentor': {
    label: 'Mentorka',
    gender: 'FEMALE',
    images: {
      idle: '/img/avatar-female-mentor.svg',
      knowing: '/img/avatar-female-mentor.svg',
      success: '/img/avatar-female-mentor.svg',
      wrong: '/img/avatar-female-mentor.svg',
    },
  },
  'female-innovator': {
    label: 'Projektantka',
    gender: 'FEMALE',
    images: {
      idle: '/img/avatar-female-innovator.svg',
      knowing: '/img/avatar-female-innovator.svg',
      success: '/img/avatar-female-innovator.svg',
      wrong: '/img/avatar-female-innovator.svg',
    },
  },
  'female-strategist': {
    label: 'Strateg',
    gender: 'FEMALE',
    images: {
      idle: '/img/avatar-female-strategist.svg',
      knowing: '/img/avatar-female-strategist.svg',
      success: '/img/avatar-female-strategist.svg',
      wrong: '/img/avatar-female-strategist.svg',
    },
  },
};

export function getAvatarLabel(key){
  return AVATAR_CATALOG[key]?.label || '';
}

export function getAvatarImage(key, mood = 'idle'){
  const entry = AVATAR_CATALOG[key];
  if (!entry) return null;
  return entry.images[mood] || entry.images.idle || null;
}

export function resolveAvatarImage(key, mood = 'idle', gender = 'MALE'){
  const image = getAvatarImage(key, mood);
  if (image) return image;
  const normalizedGender = (gender || '').toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE';
  return normalizedGender === 'FEMALE' ? '/img/female.png' : '/img/male.png';
}

export function listAvatarOptions(gender = 'MALE'){
  const normalized = (gender || '').toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE';
  return Object.entries(AVATAR_CATALOG)
    .filter(([, value]) => {
      const scope = (value.gender || 'ANY').toUpperCase();
      return scope === 'ANY' || scope === normalized;
    })
    .map(([key, value]) => ({
      key,
      label: value.label,
      image: value.images.idle,
    }));
}
