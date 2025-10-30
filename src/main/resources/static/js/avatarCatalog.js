export const AVATAR_CATALOG = {
  explorer: {
    label: 'Odkrywca',
    images: {
      idle: '/img/avatar-explorer.svg',
      knowing: '/img/avatar-explorer.svg',
      success: '/img/avatar-explorer.svg',
      wrong: '/img/avatar-explorer.svg',
    },
  },
  visionary: {
    label: 'Wizjoner',
    images: {
      idle: '/img/avatar-visionary.svg',
      knowing: '/img/avatar-visionary.svg',
      success: '/img/avatar-visionary.svg',
      wrong: '/img/avatar-visionary.svg',
    },
  },
  strategist: {
    label: 'Strateg',
    images: {
      idle: '/img/avatar-strategist.svg',
      knowing: '/img/avatar-strategist.svg',
      success: '/img/avatar-strategist.svg',
      wrong: '/img/avatar-strategist.svg',
    },
  },
  virtuoso: {
    label: 'Virtuoz',
    images: {
      idle: '/img/avatar-virtuoso.svg',
      knowing: '/img/avatar-virtuoso.svg',
      success: '/img/avatar-virtuoso.svg',
      wrong: '/img/avatar-virtuoso.svg',
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

export function listAvatarOptions(){
  return Object.entries(AVATAR_CATALOG).map(([key, value]) => ({
    key,
    label: value.label,
    image: value.images.idle,
  }));
}
